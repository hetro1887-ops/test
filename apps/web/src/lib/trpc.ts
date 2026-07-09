'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@finance/api';

export const trpc = createTRPCReact<AppRouter>();
