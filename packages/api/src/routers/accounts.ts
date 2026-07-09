import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Prisma } from '@finance/db';

// ─── Router ──────────────────────────────────────────────────────────────────

export const accountsRouter = createTRPCRouter({
  /**
   * Lists all accounts for the authenticated user with their current
   * balances and linked institution information.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
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
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
   * Returns a single account with its details and the most recent
   * transactions.
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        /** Number of recent transactions to include. */
        recentTransactionCount: z.number().int().min(0).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const account = await ctx.prisma.account.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.userId,
        },
        include: {
          plaidItem: {
            select: {
              institutionName: true,
              institutionId: true,
              status: true,
              lastSyncedAt: true,
            },
          },
          transactions: {
            orderBy: { date: 'desc' },
            take: input.recentTransactionCount,
            include: {
              merchant: {
                select: { displayName: true, logoUrl: true },
              },
              category: {
                select: { displayName: true, icon: true, color: true },
              },
            },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      return account;
    }),

  /**
   * Returns the total aggregated balance across all of the user's
   * accounts, broken down by account type.
   */
  getTotalBalance: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Aggregate by account type
      const balancesByType = await ctx.prisma.account.groupBy({
        by: ['type'],
        where: { userId: ctx.session.userId },
        _sum: {
          currentBalance: true,
          availableBalance: true,
        },
        _count: { id: true },
      });

      // Compute overall totals
      const totals = await ctx.prisma.account.aggregate({
        where: { userId: ctx.session.userId },
        _sum: {
          currentBalance: true,
          availableBalance: true,
        },
        _count: { id: true },
      });

      return {
        totalCurrentBalance: totals._sum.currentBalance,
        totalAvailableBalance: totals._sum.availableBalance,
        accountCount: totals._count.id,
        byType: balancesByType.map((b) => ({
          type: b.type,
          currentBalance: b._sum.currentBalance,
          availableBalance: b._sum.availableBalance,
          accountCount: b._count.id,
        })),
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compute total balance',
        cause: error,
      });
    }
  }),

  /**
   * Returns a daily net-flow history for an account (or all accounts)
   * over the requested number of days, constructed from transaction data.
   *
   * This is an approximation – true historical balance snapshots would
   * require periodic balance polling, which is not yet implemented.
   */
  getBalanceHistory: protectedProcedure
    .input(
      z.object({
        /** Optional account ID; if omitted, all accounts are aggregated. */
        accountId: z.string().optional(),
        /** Number of days to look back. */
        days: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      startDate.setHours(0, 0, 0, 0);

      try {
        const accountFilter: Prisma.TransactionWhereInput = {
          account: {
            userId: ctx.session.userId,
            ...(input.accountId ? { id: input.accountId } : {}),
          },
          date: { gte: startDate },
        };

        // Get the current balance as starting point
        const currentBalanceAgg = await ctx.prisma.account.aggregate({
          where: {
            userId: ctx.session.userId,
            ...(input.accountId ? { id: input.accountId } : {}),
          },
          _sum: { currentBalance: true },
        });

        const currentBalance = Number(currentBalanceAgg._sum.currentBalance ?? 0);

        // Get daily net flow
        const dailyFlow = await ctx.prisma.$queryRaw<
          Array<{ day: Date; net: Prisma.Decimal }>
        >`
          SELECT
            date_trunc('day', t.date) AS day,
            COALESCE(SUM(t.amount), 0) AS net
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          WHERE a.user_id = ${ctx.session.userId}
            ${input.accountId ? Prisma.sql`AND a.id = ${input.accountId}` : Prisma.empty}
            AND t.date >= ${startDate}
          GROUP BY date_trunc('day', t.date)
          ORDER BY day ASC
        `;

        // Build the balance history working backwards from current balance
        const flowMap = new Map(
          dailyFlow.map((row) => [
            new Date(row.day).toISOString().slice(0, 10),
            Number(row.net),
          ])
        );

        // Sum all net flows to get the total change over the period
        let totalFlow = 0;
        for (const net of flowMap.values()) {
          totalFlow += net;
        }

        // Starting balance = current balance - total flow over the period
        let runningBalance = currentBalance - totalFlow;

        const history: Array<{ date: string; balance: number }> = [];
        const cursor = new Date(startDate);
        const today = new Date();

        while (cursor <= today) {
          const dateKey = cursor.toISOString().slice(0, 10);
          const dayNet = flowMap.get(dateKey) ?? 0;
          runningBalance += dayNet;
          history.push({ date: dateKey, balance: Math.round(runningBalance * 100) / 100 });
          cursor.setDate(cursor.getDate() + 1);
        }

        return {
          currentBalance,
          history,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute balance history',
          cause: error,
        });
      }
    }),
});
