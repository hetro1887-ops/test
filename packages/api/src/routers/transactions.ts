import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Prisma } from '@finance/db';

// ─── Router ──────────────────────────────────────────────────────────────────

export const transactionsRouter = createTRPCRouter({
  /**
   * Returns a paginated, filterable list of transactions for the
   * authenticated user. Supports filtering by date range, category,
   * account, amount range, and free-text search.
   */
  list: protectedProcedure
    .input(
      z.object({
        /** 1-indexed page number. */
        page: z.number().int().min(1).default(1),
        /** Number of results per page. */
        pageSize: z.number().int().min(1).max(100).default(25),
        /** ISO date string – inclusive start of date range. */
        startDate: z.string().datetime().optional(),
        /** ISO date string – inclusive end of date range. */
        endDate: z.string().datetime().optional(),
        /** Filter by category ID. */
        categoryId: z.string().optional(),
        /** Filter by account ID. */
        accountId: z.string().optional(),
        /** Minimum transaction amount. */
        minAmount: z.number().optional(),
        /** Maximum transaction amount. */
        maxAmount: z.number().optional(),
        /** Free-text search across name, merchantName, description. */
        search: z.string().optional(),
        /** Sort field. */
        sortBy: z.enum(['date', 'amount', 'name']).default('date'),
        /** Sort direction. */
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Build the where clause
        const where: Prisma.TransactionWhereInput = {
          account: { userId: ctx.session.userId },
        };

        if (input.startDate || input.endDate) {
          where.date = {};
          if (input.startDate) where.date.gte = new Date(input.startDate);
          if (input.endDate) where.date.lte = new Date(input.endDate);
        }

        if (input.categoryId) {
          where.categoryId = input.categoryId;
        }

        if (input.accountId) {
          where.accountId = input.accountId;
        }

        if (input.minAmount !== undefined || input.maxAmount !== undefined) {
          where.amount = {};
          if (input.minAmount !== undefined) where.amount.gte = input.minAmount;
          if (input.maxAmount !== undefined) where.amount.lte = input.maxAmount;
        }

        if (input.search) {
          where.OR = [
            { name: { contains: input.search, mode: 'insensitive' } },
            { merchantName: { contains: input.search, mode: 'insensitive' } },
            { description: { contains: input.search, mode: 'insensitive' } },
          ];
        }

        const [transactions, total] = await Promise.all([
          ctx.prisma.transaction.findMany({
            where,
            include: {
              account: { select: { id: true, name: true, type: true, mask: true } },
              merchant: { select: { id: true, displayName: true, logoUrl: true } },
              category: { select: { id: true, displayName: true, icon: true, color: true } },
            },
            orderBy: { [input.sortBy]: input.sortOrder },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          ctx.prisma.transaction.count({ where }),
        ]);

        return {
          transactions,
          pagination: {
            page: input.page,
            pageSize: input.pageSize,
            total,
            totalPages: Math.ceil(total / input.pageSize),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch transactions',
          cause: error,
        });
      }
    }),

  /**
   * Returns a single transaction by ID, including related account,
   * merchant, and category data.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.transaction.findFirst({
        where: {
          id: input.id,
          account: { userId: ctx.session.userId },
        },
        include: {
          account: {
            select: { id: true, name: true, type: true, mask: true },
            include: {
              plaidItem: {
                select: { institutionName: true },
              },
            },
          },
          merchant: true,
          category: true,
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      return transaction;
    }),

  /**
   * Manually overrides the category assigned to a transaction.
   */
  updateCategory: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().min(1),
        categoryId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the user owns this transaction
      const transaction = await ctx.prisma.transaction.findFirst({
        where: {
          id: input.transactionId,
          account: { userId: ctx.session.userId },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      // Verify the category exists
      const category = await ctx.prisma.category.findUnique({
        where: { id: input.categoryId },
      });

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      const updated = await ctx.prisma.transaction.update({
        where: { id: input.transactionId },
        data: { categoryId: input.categoryId },
        include: {
          category: { select: { id: true, displayName: true, icon: true, color: true } },
        },
      });

      return updated;
    }),

  /**
   * Returns aggregated spending statistics: total spend by category
   * and monthly spending trends over the last 12 months.
   */
  getStats: protectedProcedure
    .input(
      z.object({
        /** Number of months to include in the trend data. */
        months: z.number().int().min(1).max(24).default(12),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const monthsBack = input?.months ?? 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      try {
        // Total spend by category
        const spendByCategory = await ctx.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            account: { userId: ctx.session.userId },
            date: { gte: startDate },
            amount: { gt: 0 }, // only expenses (positive = money out in Plaid)
          },
          _sum: { amount: true },
          _count: { id: true },
          orderBy: { _sum: { amount: 'desc' } },
        });

        // Enrich with category details
        const categoryIds = spendByCategory
          .map((s) => s.categoryId)
          .filter((id): id is string => id !== null);
        const categories = await ctx.prisma.category.findMany({
          where: { id: { in: categoryIds } },
        });
        const categoryLookup = new Map(categories.map((c) => [c.id, c]));

        const spendByCategoryEnriched = spendByCategory.map((s) => ({
          categoryId: s.categoryId,
          category: s.categoryId ? categoryLookup.get(s.categoryId) ?? null : null,
          totalAmount: s._sum.amount,
          count: s._count.id,
        }));

        // Monthly trend using raw query for date_trunc
        const monthlyTrend = await ctx.prisma.$queryRaw<
          Array<{ month: Date; total: Prisma.Decimal; count: bigint }>
        >`
          SELECT
            date_trunc('month', t.date) AS month,
            COALESCE(SUM(t.amount), 0) AS total,
            COUNT(t.id) AS count
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          WHERE a.user_id = ${ctx.session.userId}
            AND t.date >= ${startDate}
            AND t.amount > 0
          GROUP BY date_trunc('month', t.date)
          ORDER BY month ASC
        `;

        // Overall totals
        const totals = await ctx.prisma.transaction.aggregate({
          where: {
            account: { userId: ctx.session.userId },
            date: { gte: startDate },
          },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true },
        });

        return {
          period: {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
            months: monthsBack,
          },
          totals: {
            totalSpend: totals._sum.amount,
            transactionCount: totals._count.id,
            averageTransaction: totals._avg.amount,
          },
          spendByCategory: spendByCategoryEnriched,
          monthlyTrend: monthlyTrend.map((row) => ({
            month: row.month,
            total: row.total,
            count: Number(row.count),
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute transaction stats',
          cause: error,
        });
      }
    }),

  /**
   * Returns a month-by-month breakdown of spending by category,
   * designed for chart consumption.
   */
  getMonthlyBreakdown: protectedProcedure
    .input(
      z.object({
        /** Number of months to look back from today. */
        months: z.number().int().min(1).max(24).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - input.months);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      try {
        const breakdown = await ctx.prisma.$queryRaw<
          Array<{
            month: Date;
            category_id: string | null;
            category_name: string | null;
            category_color: string | null;
            category_icon: string | null;
            total: Prisma.Decimal;
            count: bigint;
          }>
        >`
          SELECT
            date_trunc('month', t.date) AS month,
            c.id AS category_id,
            c.display_name AS category_name,
            c.color AS category_color,
            c.icon AS category_icon,
            COALESCE(SUM(t.amount), 0) AS total,
            COUNT(t.id) AS count
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE a.user_id = ${ctx.session.userId}
            AND t.date >= ${startDate}
            AND t.amount > 0
          GROUP BY date_trunc('month', t.date), c.id, c.display_name, c.color, c.icon
          ORDER BY month ASC, total DESC
        `;

        // Group by month for easier frontend consumption
        const grouped = new Map<string, {
          month: string;
          categories: Array<{
            categoryId: string | null;
            categoryName: string | null;
            categoryColor: string | null;
            categoryIcon: string | null;
            total: Prisma.Decimal;
            count: number;
          }>;
        }>();

        for (const row of breakdown) {
          const monthKey = new Date(row.month).toISOString().slice(0, 7); // YYYY-MM
          if (!grouped.has(monthKey)) {
            grouped.set(monthKey, { month: monthKey, categories: [] });
          }
          grouped.get(monthKey)!.categories.push({
            categoryId: row.category_id,
            categoryName: row.category_name,
            categoryColor: row.category_color,
            categoryIcon: row.category_icon,
            total: row.total,
            count: Number(row.count),
          });
        }

        return Array.from(grouped.values());
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute monthly breakdown',
          cause: error,
        });
      }
    }),
});
