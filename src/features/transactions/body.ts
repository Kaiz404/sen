import type { AppError } from '@/models/errors';

import type { HistoryRows } from './rows';

export type SyncFailure = Extract<
  AppError,
  { kind: 'offline' | 'timeout' | 'server' | 'storage' | 'unknown' }
>;

/** Where the last sync stands. A running sync forgets the last failure, as a retry should. */
export type SyncView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'failed'; readonly error: AppError };

/** A read from the database rejected, which no retry of the bank sync fixes. */
export type ReadFailure = { readonly kind: 'unreadable' };

/** One shared value, so a screen that rebuilds its body keeps the same failure. */
const UNREADABLE: ReadFailure = { kind: 'unreadable' };

/** What fills the screen under the header. */
export type HistoryBody =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly error: SyncFailure | ReadFailure }
  | { readonly kind: 'empty' }
  | { readonly kind: 'no-results' }
  | { readonly kind: 'list'; readonly rows: HistoryRows };

/** A calm line over a list that is still worth reading. */
export type Banner = { readonly kind: SyncFailure['kind']; readonly since: string | null };

export type BodyInput = {
  /** Undefined until the first page is read. */
  readonly rows: HistoryRows | undefined;
  /** Whether the database has ever finished a sync page. Undefined until that is read. */
  readonly synced: boolean | undefined;
  readonly sync: SyncView;
  /** A search or the In and Out filter is on. */
  readonly filtered: boolean;
  /** A page or sync-state read rejected. */
  readonly unreadable: boolean;
};

/** The sync errors that fill the screen or raise the banner. Others (bad rows, a reset) have their own notes. */
export function asSyncFailure(error: AppError): SyncFailure | null {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
    case 'server':
    case 'storage':
    case 'unknown':
      return error;
    default:
      return null;
  }
}

function syncFailure(sync: SyncView): SyncFailure | null {
  return sync.kind === 'failed' ? asSyncFailure(sync.error) : null;
}

export function historyBody({ rows, synced, sync, filtered, unreadable }: BodyInput): HistoryBody {
  if (rows !== undefined && rows.items.length > 0) return { kind: 'list', rows };
  // TanStack keeps the last good data through a failed refetch, so stale empty rows or a stale `synced`
  // must not hide that the reads now reject.
  if (unreadable) return { kind: 'failed', error: UNREADABLE };
  if (rows === undefined) return { kind: 'loading' };
  const failure = syncFailure(sync);
  if (synced !== true)
    return failure === null ? { kind: 'loading' } : { kind: 'failed', error: failure };
  if (filtered) return { kind: 'no-results' };
  return failure === null ? { kind: 'empty' } : { kind: 'failed', error: failure };
}

/** The banner over a list after a failed sync, and how many bank rows the last sync couldn't read. */
export function syncNotes(
  sync: SyncView,
  body: HistoryBody,
  since: string | null,
): { readonly banner: Banner | null; readonly skipped: number } {
  const failure = syncFailure(sync);
  const showsList = body.kind === 'list' || body.kind === 'no-results';
  return {
    banner: failure !== null && showsList ? { kind: failure.kind, since } : null,
    skipped: sync.kind === 'failed' && sync.error.kind === 'invalid_data' ? sync.error.skipped : 0,
  };
}
