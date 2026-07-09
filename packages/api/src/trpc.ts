import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { PrismaClient } from '@finance/db';

// ─── Context ─────────────────────────────────────────────────────────────────

/** Session payload attached to authenticated requests. */
export interface Session {
  userId: string;
  email: string;
  name: string;
}

/** Context available to every tRPC procedure. */
export interface TRPCContext {
  prisma: PrismaClient;
  session: Session | null;
}

// ─── tRPC Instance ───────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Logging middleware – logs the procedure path and execution time for
 * every call in development mode.
 */
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[tRPC] ${type} ${path} – ${durationMs}ms`);
  }

  return result;
});

/**
 * Authentication middleware – ensures a valid session is present on the
 * context. Throws UNAUTHORIZED if no session is found.
 */
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session, // session is now guaranteed non-null
    },
  });
});

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Create a new tRPC router. */
export const createTRPCRouter = t.router;

/**
 * Public procedure – accessible without authentication.
 * Includes request logging middleware.
 */
export const publicProcedure = t.procedure.use(loggerMiddleware);

/**
 * Protected procedure – requires a valid session.
 * Includes both logging and auth-enforcement middleware.
 */
export const protectedProcedure = t.procedure
  .use(loggerMiddleware)
  .use(enforceAuth);
