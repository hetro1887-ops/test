import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';

/**
 * tRPC router for Action Engine: savings automation, transfers, round-ups, and money movement.
 */
export const actionsRouter = createTRPCRouter({
  // ─── Savings Goals ──────────────────────────────────────────────────────────

  listSavingGoals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.savingGoal.findMany({
      where: { userId: ctx.session.userId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createSavingGoal: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        targetAmount: z.number().positive(),
        targetDate: z.string().datetime().optional(),
        roundUpEnabled: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.savingGoal.create({
        data: {
          userId: ctx.session.userId,
          name: input.name,
          targetAmount: input.targetAmount,
          roundUpEnabled: input.roundUpEnabled,
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
        },
      });
    }),

  updateSavingGoalProgress: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        amountToAdd: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const goal = await ctx.prisma.savingGoal.findUnique({
        where: { id: input.goalId },
      });

      if (!goal || goal.userId !== ctx.session.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Saving goal not found' });
      }

      return ctx.prisma.savingGoal.update({
        where: { id: input.goalId },
        data: {
          currentAmount: Number(goal.currentAmount) + input.amountToAdd,
        },
      });
    }),

  // ─── Transfer Suggestions & Money Movement ──────────────────────────────────

  listTransferSuggestions: protectedProcedure.query(async ({ ctx }) => {
    // Return mock & generated cash optimization transfer suggestions
    const userId = ctx.session.userId;
    
    // Check if user has suggestions already. If not, generate some based on accounts
    const existing = await ctx.prisma.transferSuggestion.findMany({
      where: { userId, status: 'SUGGESTED' },
    });

    if (existing.length > 0) {
      return existing;
    }

    // Heuristic generator:
    // Look at accounts. If Checking balance is > $2000, suggest moving excess to Savings goal
    const accounts = await ctx.prisma.account.findMany({
      where: { userId },
    });

    const checking = accounts.find(a => a.type === 'CHECKING');
    const savings = accounts.find(a => a.type === 'SAVINGS');

    if (checking && savings && Number(checking.currentBalance) > 3000) {
      const excess = Math.round((Number(checking.currentBalance) - 2000) * 100) / 100;
      
      const newSuggestion = await ctx.prisma.transferSuggestion.create({
        data: {
          userId,
          sourceAccountId: checking.id,
          targetAccountId: savings.id,
          amount: excess > 500 ? 500 : excess,
          reason: `High checking balance identified. Move $${excess > 500 ? 500 : excess} to your savings account to earn interest.`,
          status: 'SUGGESTED',
        },
      });
      return [newSuggestion];
    }

    return [];
  }),

  executeTransfer: protectedProcedure
    .input(
      z.object({
        suggestionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const suggestion = await ctx.prisma.transferSuggestion.findUnique({
        where: { id: input.suggestionId },
      });

      if (!suggestion || suggestion.userId !== ctx.session.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' });
      }

      // Simulate Plaid Transfer / Stripe API money movement call
      console.log(`[Action Engine] Moving $${suggestion.amount} from ${suggestion.sourceAccountId} to ${suggestion.targetAccountId}`);

      // Perform simulated update on db balances
      const srcAccount = await ctx.prisma.account.findUnique({ where: { id: suggestion.sourceAccountId } });
      const destAccount = await ctx.prisma.account.findUnique({ where: { id: suggestion.targetAccountId } });

      if (srcAccount && destAccount) {
        await ctx.prisma.account.update({
          where: { id: srcAccount.id },
          data: { currentBalance: Number(srcAccount.currentBalance) - Number(suggestion.amount) },
        });

        await ctx.prisma.account.update({
          where: { id: destAccount.id },
          data: { currentBalance: Number(destAccount.currentBalance) + Number(suggestion.amount) },
        });
      }

      return ctx.prisma.transferSuggestion.update({
        where: { id: input.suggestionId },
        data: {
          status: 'EXECUTED',
          executionId: `txn_stripe_${Math.random().toString(36).substring(2, 11)}`,
        },
      });
    }),

  // ─── Round-Up Savings Engine ────────────────────────────────────────────────

  triggerRoundUps: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.userId;
    
    // Find round-up enabled goals
    const goals = await ctx.prisma.savingGoal.findMany({
      where: { userId, roundUpEnabled: true },
    });

    if (goals.length === 0) {
      return { roundedCount: 0, totalSaved: 0 };
    }

    // Get transactions in the last 7 days that haven't been rounded up yet
    // For this simulation, we'll fetch transactions, compute their round-up value
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        account: { userId },
        amount: { gt: 0 }, // only expenses
        date: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
    });

    let totalSaved = 0;
    let roundedCount = 0;

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const ceiling = Math.ceil(amount);
      const difference = ceiling - amount;

      if (difference > 0 && difference < 1.0) {
        totalSaved += difference;
        roundedCount++;
      }
    }

    // Distribute savings to the first active round-up goal
    if (totalSaved > 0) {
      const targetGoal = goals[0];
      await ctx.prisma.savingGoal.update({
        where: { id: targetGoal.id },
        data: {
          currentAmount: Number(targetGoal.currentAmount) + totalSaved,
        },
      });
    }

    return {
      roundedCount,
      totalSaved: Math.round(totalSaved * 100) / 100,
    };
  }),
});
