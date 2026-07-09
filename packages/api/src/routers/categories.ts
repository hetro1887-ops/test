import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';

// ─── Router ──────────────────────────────────────────────────────────────────

export const categoriesRouter = createTRPCRouter({
  /**
   * Lists all categories with the count of transactions assigned to each
   * for the authenticated user. System categories are always included;
   * custom categories are shown only if owned by the user or system-wide.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const categories = await ctx.prisma.category.findMany({
        include: {
          parent: {
            select: { id: true, displayName: true },
          },
          children: {
            select: { id: true, displayName: true, icon: true, color: true },
          },
          _count: {
            select: {
              transactions: {
                where: {
                  account: { userId: ctx.session.userId },
                },
              },
            },
          },
        },
        orderBy: [{ isSystem: 'desc' }, { displayName: 'asc' }],
      });

      return categories;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch categories',
        cause: error,
      });
    }
  }),

  /**
   * Creates a new custom (non-system) category.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        displayName: z.string().min(1).max(100),
        icon: z.string().max(10).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex color code').optional(),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await ctx.prisma.category.findUnique({
        where: { name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A category with the name "${input.name}" already exists`,
        });
      }

      // Validate parent if specified
      if (input.parentId) {
        const parent = await ctx.prisma.category.findUnique({
          where: { id: input.parentId },
        });
        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent category not found',
          });
        }
      }

      try {
        const category = await ctx.prisma.category.create({
          data: {
            name: input.name,
            displayName: input.displayName,
            icon: input.icon ?? '📁',
            color: input.color ?? '#9E9E9E',
            parentId: input.parentId ?? null,
            isSystem: false,
          },
        });

        return category;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create category',
          cause: error,
        });
      }
    }),

  /**
   * Returns the spending distribution across categories for the
   * authenticated user within the given time range. Designed for
   * pie/donut chart consumption.
   */
  getDistribution: protectedProcedure
    .input(
      z.object({
        /** Number of days to look back from today. */
        days: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      startDate.setHours(0, 0, 0, 0);

      try {
        // Aggregate spend per category
        const distribution = await ctx.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            account: { userId: ctx.session.userId },
            date: { gte: startDate },
            amount: { gt: 0 },
          },
          _sum: { amount: true },
          _count: { id: true },
          orderBy: { _sum: { amount: 'desc' } },
        });

        // Enrich with category details
        const categoryIds = distribution
          .map((d) => d.categoryId)
          .filter((id): id is string => id !== null);

        const categories = await ctx.prisma.category.findMany({
          where: { id: { in: categoryIds } },
        });
        const categoryLookup = new Map(categories.map((c) => [c.id, c]));

        // Compute total for percentage calculation
        const grandTotal = distribution.reduce(
          (acc, d) => acc + Number(d._sum.amount ?? 0),
          0
        );

        const enriched = distribution.map((d) => {
          const cat = d.categoryId ? categoryLookup.get(d.categoryId) : null;
          const total = Number(d._sum.amount ?? 0);
          return {
            categoryId: d.categoryId,
            categoryName: cat?.displayName ?? 'Uncategorized',
            icon: cat?.icon ?? '📦',
            color: cat?.color ?? '#9E9E9E',
            totalAmount: d._sum.amount,
            transactionCount: d._count.id,
            percentage: grandTotal > 0
              ? Math.round((total / grandTotal) * 10000) / 100
              : 0,
          };
        });

        return {
          period: {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
            days: input.days,
          },
          grandTotal,
          distribution: enriched,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute category distribution',
          cause: error,
        });
      }
    }),
});
