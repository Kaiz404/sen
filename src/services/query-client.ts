import { QueryClient } from '@tanstack/react-query';

import { type AppError, isRetryable } from '@/models/errors';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AppError;
  }
}

/**
 * The one query cache. It sits below every feature, so auth can clear it on lock and the write path can
 * invalidate `['tx']` without a cycle between features. Queries read a local database, so they never retry
 * and stay fresh until a write invalidates them. Mutations retry transport errors once, never data errors.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: (failures, error) => failures < 1 && isRetryable(error) },
  },
});

/** Query key roots, so `invalidateQueries({ queryKey: QK.tx })` and `removeQueries({ queryKey: QK.revealed })` agree. */
export const QK = {
  tx: ['tx'],
  revealed: ['tx', 'revealed'],
} as const;
