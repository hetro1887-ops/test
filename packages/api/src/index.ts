/**
 * @module @finance/api
 *
 * Public API surface for the tRPC API package.
 * Re-exports the root router, router type, context utilities,
 * and procedure builders so consuming packages (e.g. the Next.js app)
 * can wire everything up without reaching into internal paths.
 */

export { appRouter, type AppRouter } from './root';
export {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  type TRPCContext,
  type Session,
} from './trpc';
