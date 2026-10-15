import { QueryClient } from '@tanstack/react-query';

import { type AppError, isRetryable } from '@/models/errors';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AppError;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: (failures, error) => failures < 1 && isRetryable(error) },
  },
});

export const QK = {
  tx: ['tx'],
  revealed: ['tx', 'revealed'],
} as const;
