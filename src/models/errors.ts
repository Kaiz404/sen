import { z } from 'zod';

export const AppErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offline') }),
  z.object({ kind: z.literal('timeout') }),
  z.object({ kind: z.literal('server') }),
  z.object({ kind: z.literal('invalid_data'), skipped: z.number().int().positive() }),
  z.object({ kind: z.literal('storage') }),
  z.object({ kind: z.literal('unknown') }),
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

/** SQLITE_FULL (13) and SQLITE_IOERR (10) with any extended code, as a code name, a number or expo-sqlite's message. */
const DISK_FAILURE =
  /\b(?:ENOSPC|SQLITE_FULL|SQLITE_IOERR\w*)\b|database or disk is full|disk I\/O error|Error code (?:13|10)\b/;
const DISK_CODES: readonly number[] = [10, 13];

function isDiskFailure(thrown: unknown): boolean {
  if (!(thrown instanceof Error)) return false;
  const { code, errcode } = thrown as { code?: unknown; errcode?: unknown };
  const numeric = typeof errcode === 'number' ? errcode : typeof code === 'number' ? code : null;
  if (numeric !== null && DISK_CODES.includes(numeric & 0xff)) return true;
  return DISK_FAILURE.test(`${typeof code === 'string' ? code : ''} ${thrown.message}`);
}

/**
 * The TanStack boundary: whatever a sync throws that is not already an `AppError`. A full or failing disk is
 * `storage`, which tells the user to free space. Anything else is `unknown`, so no other bug blames the disk.
 */
export function toAppError(thrown: unknown): AppError {
  if (isAppError(thrown)) return thrown;
  return isDiskFailure(thrown) ? { kind: 'storage' } : { kind: 'unknown' };
}

export function isRetryable(error: AppError): boolean {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
    case 'server':
      return true;
    case 'invalid_data':
    case 'storage':
    case 'unknown':
    case 'db_reset':
      return false;
  }
}
