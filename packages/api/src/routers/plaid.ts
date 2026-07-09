import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { encrypt } from '@finance/db';

// ─── Plaid Client ────────────────────────────────────────────────────────────

/**
 * Returns a configured Plaid API client.
 * Uses environment variables for credentials and environment selection.
 */
function getPlaidClient(): PlaidApi {
  const configuration = new Configuration({
    basePath:
      PlaidEnvironments[
        (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || 'sandbox'
      ],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_SECRET || '',
      },
    },
  });
  return new PlaidApi(configuration);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const plaidRouter = createTRPCRouter({
  /**
   * Creates a Plaid Link token that the frontend uses to initialise the
   * Plaid Link flow.
   */
  createLinkToken: protectedProcedure
    .input(
      z.object({
        /** Optional existing access token for update mode. */
        accessToken: z.string().optional(),
      }).optional()
    )
    .mutation(async ({ ctx }) => {
      try {
        const client = getPlaidClient();
        const response = await client.linkTokenCreate({
          user: { client_user_id: ctx.session.userId },
          client_name: 'Finance Dashboard',
          products: [Products.Transactions],
          country_codes: [CountryCode.Us],
          language: 'en',
          webhook: process.env.PLAID_WEBHOOK_URL || 'http://localhost:3000/api/webhooks/plaid',
        });

        return { linkToken: response.data.link_token };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Plaid link token',
          cause: error,
        });
      }
    }),

  /**
   * Exchanges a Plaid public token (from Link) for a persistent access
   * token. The access token is encrypted with AES-256-GCM before being
   * stored in the database.
   */
  exchangePublicToken: protectedProcedure
    .input(
      z.object({
        publicToken: z.string().min(1, 'Public token is required'),
        institutionId: z.string().min(1),
        institutionName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const client = getPlaidClient();
        const exchangeResponse = await client.itemPublicTokenExchange({
          public_token: input.publicToken,
        });

        const accessToken = exchangeResponse.data.access_token;
        const itemId = exchangeResponse.data.item_id;

        // Encrypt the access token before storage
        const encryptedToken = encrypt(accessToken);

        // Create the PlaidItem record
        const plaidItem = await ctx.prisma.plaidItem.create({
          data: {
            userId: ctx.session.userId,
            accessTokenEncrypted: encryptedToken,
            itemId,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            status: 'ACTIVE',
            webhookUrl:
              process.env.PLAID_WEBHOOK_URL ||
              'http://localhost:3000/api/webhooks/plaid',
          },
        });

        // Fetch and store the accounts for this item
        const accountsResponse = await client.accountsGet({
          access_token: accessToken,
        });

        for (const acct of accountsResponse.data.accounts) {
          await ctx.prisma.account.upsert({
            where: { plaidAccountId: acct.account_id },
            update: {
              currentBalance: acct.balances.current ?? 0,
              availableBalance: acct.balances.available,
              limitAmount: acct.balances.limit,
              lastSyncedAt: new Date(),
            },
            create: {
              userId: ctx.session.userId,
              plaidItemId: plaidItem.id,
              plaidAccountId: acct.account_id,
              name: acct.name,
              officialName: acct.official_name,
              type: mapAccountType(acct.type),
              subtype: acct.subtype ?? null,
              mask: acct.mask,
              currentBalance: acct.balances.current ?? 0,
              availableBalance: acct.balances.available,
              limitAmount: acct.balances.limit,
              isoCurrencyCode: acct.balances.iso_currency_code ?? 'USD',
              lastSyncedAt: new Date(),
            },
          });
        }

        return {
          itemId: plaidItem.id,
          institutionName: input.institutionName,
          accountCount: accountsResponse.data.accounts.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to exchange public token',
          cause: error,
        });
      }
    }),

  /**
   * Lists all Plaid-linked accounts for the authenticated user.
   */
  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    try {
      const accounts = await ctx.prisma.account.findMany({
        where: { userId: ctx.session.userId },
        include: {
          plaidItem: {
            select: {
              institutionName: true,
              institutionId: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return accounts;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch accounts',
        cause: error,
      });
    }
  }),

  /**
   * Triggers an incremental transaction sync for a specific PlaidItem
   * using the Plaid `/transactions/sync` endpoint with cursor-based
   * pagination.
   */
  syncTransactions: protectedProcedure
    .input(
      z.object({
        plaidItemId: z.string().min(1, 'PlaidItem ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createHash } = await import('crypto');
      const { decrypt } = await import('@finance/db');

      // Verify ownership
      const plaidItem = await ctx.prisma.plaidItem.findFirst({
        where: {
          id: input.plaidItemId,
          userId: ctx.session.userId,
        },
      });

      if (!plaidItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'PlaidItem not found or access denied',
        });
      }

      // Create sync log
      const syncLog = await ctx.prisma.syncLog.create({
        data: {
          plaidItemId: plaidItem.id,
          status: 'STARTED',
        },
      });

      try {
        const client = getPlaidClient();
        const accessToken = decrypt(plaidItem.accessTokenEncrypted);
        let cursor = plaidItem.cursor ?? undefined;
        let added = 0;
        let modified = 0;
        let removed = 0;
        let hasMore = true;

        while (hasMore) {
          const response = await client.transactionsSync({
            access_token: accessToken,
            cursor,
          });

          const data = response.data;

          // Process added transactions
          for (const tx of data.added) {
            const hash = createHash('sha256')
              .update(`${tx.transaction_id}:${tx.account_id}`)
              .digest('hex');

            // Look up the account
            const account = await ctx.prisma.account.findUnique({
              where: { plaidAccountId: tx.account_id },
            });
            if (!account) continue;

            await ctx.prisma.transaction.upsert({
              where: { plaidTransactionId: tx.transaction_id },
              update: {
                amount: tx.amount,
                name: tx.name,
                merchantName: tx.merchant_name,
                date: new Date(tx.date),
                authorizedDate: tx.authorized_date
                  ? new Date(tx.authorized_date)
                  : null,
                pending: tx.pending,
                paymentChannel: mapPaymentChannel(tx.payment_channel),
                locationCity: tx.location?.city,
                locationRegion: tx.location?.region,
                locationCountry: tx.location?.country,
                personalFinanceCategoryPrimary:
                  tx.personal_finance_category?.primary,
                personalFinanceCategoryDetailed:
                  tx.personal_finance_category?.detailed,
              },
              create: {
                accountId: account.id,
                plaidTransactionId: tx.transaction_id,
                amount: tx.amount,
                name: tx.name,
                merchantName: tx.merchant_name,
                date: new Date(tx.date),
                authorizedDate: tx.authorized_date
                  ? new Date(tx.authorized_date)
                  : null,
                pending: tx.pending,
                paymentChannel: mapPaymentChannel(tx.payment_channel),
                transactionType: tx.transaction_type ?? null,
                isoCurrencyCode: tx.iso_currency_code ?? 'USD',
                locationCity: tx.location?.city,
                locationRegion: tx.location?.region,
                locationCountry: tx.location?.country,
                personalFinanceCategoryPrimary:
                  tx.personal_finance_category?.primary,
                personalFinanceCategoryDetailed:
                  tx.personal_finance_category?.detailed,
                hash,
              },
            });
            added++;
          }

          // Process modified transactions
          for (const tx of data.modified) {
            await ctx.prisma.transaction.updateMany({
              where: { plaidTransactionId: tx.transaction_id },
              data: {
                amount: tx.amount,
                name: tx.name,
                merchantName: tx.merchant_name,
                date: new Date(tx.date),
                pending: tx.pending,
              },
            });
            modified++;
          }

          // Process removed transactions
          for (const tx of data.removed) {
            if (tx.transaction_id) {
              await ctx.prisma.transaction.deleteMany({
                where: { plaidTransactionId: tx.transaction_id },
              });
              removed++;
            }
          }

          cursor = data.next_cursor;
          hasMore = data.has_more;
        }

        // Update PlaidItem cursor
        await ctx.prisma.plaidItem.update({
          where: { id: plaidItem.id },
          data: { cursor },
        });

        // Update sync log
        await ctx.prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'COMPLETED',
            addedCount: added,
            modifiedCount: modified,
            removedCount: removed,
            completedAt: new Date(),
          },
        });

        return { added, modified, removed };
      } catch (error) {
        await ctx.prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'FAILED',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Transaction sync failed',
          cause: error,
        });
      }
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps a Plaid account type string to our AccountType enum.
 */
function mapAccountType(plaidType: string): 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'INVESTMENT' | 'OTHER' {
  const mapping: Record<string, 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'INVESTMENT' | 'OTHER'> = {
    depository: 'CHECKING',
    credit: 'CREDIT',
    loan: 'LOAN',
    investment: 'INVESTMENT',
    brokerage: 'INVESTMENT',
  };
  return mapping[plaidType.toLowerCase()] ?? 'OTHER';
}

/**
 * Maps a Plaid payment channel string to our PaymentChannel enum.
 */
function mapPaymentChannel(channel: string): 'ONLINE' | 'IN_STORE' | 'OTHER' {
  const mapping: Record<string, 'ONLINE' | 'IN_STORE' | 'OTHER'> = {
    online: 'ONLINE',
    'in store': 'IN_STORE',
    other: 'OTHER',
  };
  return mapping[channel.toLowerCase()] ?? 'OTHER';
}
