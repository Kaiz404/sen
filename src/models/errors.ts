import { z } from 'zod';

export const AppErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offline') }),
  z.object({ kind: z.literal('timeout') }),
  z.object({ kind: z.literal('server') }),
  z.object({ kind: z.literal('invalid_data'), skipped: z.number().int().positive() }),
  z.object({ kind: z.literal('db_reset'), reason: z.enum(['missing_key', 'corrupt']) }),
]);
export type AppError = Readonly<z.infer<typeof AppErrorSchema>>;
export type AppErrorKind = AppError['kind'];

export type Result<T, E = AppError> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isAppError(thrown: unknown): thrown is AppError {
  return AppErrorSchema.safeParse(thrown).success;
}

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
