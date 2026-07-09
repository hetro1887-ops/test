import { Job } from 'bullmq';
import { Configuration, PlaidApi, PlaidEnvironments, Transaction as PlaidTransaction, RemovedTransaction } from 'plaid';
import { prisma, decrypt } from '@finance/db';
import { createHash } from 'crypto';
import { categorizeQueue, enrichQueue } from '../queues';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});
const plaidClient = new PlaidApi(configuration);

/**
 * Generates a stable unique hash for transaction deduplication.
 */
function generateTxnHash(plaidTxnId: string, accountId: string, amount: number, dateStr: string): string {
  return createHash('sha256')
    .update(`${plaidTxnId}:${accountId}:${amount}:${dateStr}`)
    .digest('hex');
}

/**
 * Job worker for Plaid incremental sync.
 */
export async function handleSyncJob(job: Job<{ plaidItemId: string }>) {
  const { plaidItemId } = job.data;
  console.log(`[Sync Worker] Starting sync for Plaid Item: ${plaidItemId}`);

  const item = await prisma.plaidItem.findUnique({
    where: { id: plaidItemId },
  });

  if (!item) {
    throw new Error(`PlaidItem not found: ${plaidItemId}`);
  }

  // Decrypt access token
  const accessToken = decrypt(item.accessTokenEncrypted);
  
  // Create Sync Log
  const syncLog = await prisma.syncLog.create({
    data: {
      plaidItemId,
      status: 'STARTED',
    },
  });

  let cursor = item.cursor || undefined;
  let added: PlaidTransaction[] = [];
  let modified: PlaidTransaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;

  try {
    // 1. Sync accounts and balances first
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    
    for (const plaidAcc of accountsResponse.data.accounts) {
      await prisma.account.upsert({
        where: { plaidAccountId: plaidAcc.account_id },
        update: {
          name: plaidAcc.name,
          officialName: plaidAcc.official_name || null,
          currentBalance: plaidAcc.balances.current ?? 0,
          availableBalance: plaidAcc.balances.available ?? null,
          limitAmount: plaidAcc.balances.limit ?? null,
          isoCurrencyCode: plaidAcc.balances.iso_currency_code || 'USD',
          lastSyncedAt: new Date(),
        },
        create: {
          userId: item.userId,
          plaidItemId: item.id,
          plaidAccountId: plaidAcc.account_id,
          name: plaidAcc.name,
          officialName: plaidAcc.official_name || null,
          type: (plaidAcc.type.toUpperCase() as any) || 'CHECKING',
          subtype: plaidAcc.subtype || null,
          mask: plaidAcc.mask || null,
          currentBalance: plaidAcc.balances.current ?? 0,
          availableBalance: plaidAcc.balances.available ?? null,
          limitAmount: plaidAcc.balances.limit ?? null,
          isoCurrencyCode: plaidAcc.balances.iso_currency_code || 'USD',
          lastSyncedAt: new Date(),
        },
      });
    }

    // 2. Fetch incremental transactions changes
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      });

      added = added.concat(response.data.added);
      modified = modified.concat(response.data.modified);
      removed = removed.concat(response.data.removed);
      
      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    console.log(
      `[Sync Worker] Fetched changes: Added=${added.length}, Modified=${modified.length}, Removed=${removed.length}`
    );

    // Get mapped local accounts mapping Plaid ID -> Db ID
    const dbAccounts = await prisma.account.findMany({
      where: { plaidItemId: item.id },
      select: { id: true, plaidAccountId: true },
    });
    const accountMap = new Map(dbAccounts.map(a => [a.plaidAccountId, a.id]));

    // 3. Process Removed Transactions
    if (removed.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          plaidTransactionId: { in: removed.map(r => r.transaction_id || '').filter(Boolean) },
        },
      });
    }

    // 4. Process Added & Modified Transactions
    const upsertedTxnIds: string[] = [];
    const allTxnsToProcess = [...added, ...modified];

    for (const txn of allTxnsToProcess) {
      const localAccountId = accountMap.get(txn.account_id);
      if (!localAccountId) {
        console.warn(`[Sync Worker] Account ID ${txn.account_id} not found in DB. Skipping transaction.`);
        continue;
      }

      const amount = txn.amount;
      const date = new Date(txn.date);
      const name = txn.name;
      const merchantName = txn.merchant_name || null;
      const description = txn.original_description || null;
      const plaidTxnId = txn.transaction_id;

      // Deduplicate hash
      const hash = generateTxnHash(plaidTxnId, localAccountId, amount, txn.date);

      const dbTxn = await prisma.transaction.upsert({
        where: { plaidTransactionId: plaidTxnId },
        update: {
          amount,
          name,
          merchantName,
          description,
          date,
          authorizedDate: txn.authorized_date ? new Date(txn.authorized_date) : null,
          pending: txn.pending ?? false,
          paymentChannel: (txn.payment_channel.toUpperCase() as any) || 'OTHER',
          transactionType: txn.transaction_type || null,
          isoCurrencyCode: txn.iso_currency_code || 'USD',
          locationCity: txn.location?.city || null,
          locationRegion: txn.location?.region || null,
          locationCountry: txn.location?.country || null,
          personalFinanceCategoryPrimary: txn.personal_finance_category?.primary || null,
          personalFinanceCategoryDetailed: txn.personal_finance_category?.detailed || null,
          hash,
        },
        create: {
          accountId: localAccountId,
          plaidTransactionId: plaidTxnId,
          amount,
          name,
          merchantName,
          description,
          date,
          authorizedDate: txn.authorized_date ? new Date(txn.authorized_date) : null,
          pending: txn.pending ?? false,
          paymentChannel: (txn.payment_channel.toUpperCase() as any) || 'OTHER',
          transactionType: txn.transaction_type || null,
          isoCurrencyCode: txn.iso_currency_code || 'USD',
          locationCity: txn.location?.city || null,
          locationRegion: txn.location?.region || null,
          locationCountry: txn.location?.country || null,
          personalFinanceCategoryPrimary: txn.personal_finance_category?.primary || null,
          personalFinanceCategoryDetailed: txn.personal_finance_category?.detailed || null,
          hash,
        },
      });

      upsertedTxnIds.push(dbTxn.id);
    }

    // Update PlaidItem cursor
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: { cursor },
    });

    // Update Sync Log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'COMPLETED',
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        completedAt: new Date(),
      },
    });

    // 5. Trigger enrichment & ML categorization for new/modified transactions
    for (const txnId of upsertedTxnIds) {
      await categorizeQueue.add('categorize', { transactionId: txnId });
      await enrichQueue.add('enrich', { transactionId: txnId });
    }

    console.log(`[Sync Worker] Successfully completed sync for Plaid Item: ${plaidItemId}`);
  } catch (error: any) {
    console.error(`[Sync Worker] Sync failed for Plaid Item ${plaidItemId}:`, error);
    
    // Update Sync Log as failed
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message || String(error),
        completedAt: new Date(),
      },
    });

    throw error;
  }
}
