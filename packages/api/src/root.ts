import { createTRPCRouter } from './trpc';
import { plaidRouter } from './routers/plaid';
import { transactionsRouter } from './routers/transactions';
import { accountsRouter } from './routers/accounts';
import { categoriesRouter } from './routers/categories';
import { chatRouter } from './routers/chat';
import { actionsRouter } from './routers/actions';

/**
 * Root application router.
 *
 * Combines all domain routers into a single tRPC router that is
 * exposed to the frontend via Next.js API routes.
 */
export const appRouter = createTRPCRouter({
  plaid: plaidRouter,
  transactions: transactionsRouter,
  accounts: accountsRouter,
  categories: categoriesRouter,
  chat: chatRouter,
  actions: actionsRouter,
});

/** The type of the root router – used by the tRPC client for inference. */
export type AppRouter = typeof appRouter;
