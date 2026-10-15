import { z } from 'zod';

/**
 * Every failure with a designed state. `queryFn` and `mutationFn` throw these. Pure and service code returns
 * them inside a `Result`. A new kind fails `tsc` at every exhaustive switch.
 */
export const AppErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offline') }),
  z.object({ kind: z.literal('timeout') }),
  z.object({ kind: z.literal('server') }),
  z.object({ kind: z.literal('invalid_data'), skipped: z.number().int().positive() }),
  z.object({ kind: z.literal('db_reset'), reason: z.enum(['missing_key', 'corrupt']) }),
]);
export type AppError = Readonly<z.infer<typeof AppErrorSchema>>;
export type AppErrorKind = AppError['kind'];

/** `data`, not `value`: lint bans `.value` member access so shared values go through `.get()`. */
export type Result<T, E = AppError> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** For the TanStack seam and the route ErrorBoundary: a thrown value is either an AppError or a bug. */
export function isAppError(thrown: unknown): thrown is AppError {
  return AppErrorSchema.safeParse(thrown).success;
}

/** Transport failures can succeed on a second try. Bad data and a reset database never will. */
export function isRetryable(error: AppError): boolean {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
    case 'server':
      return true;
    case 'invalid_data':
    case 'db_reset':
      return false;
  }
}
