import type { AppError } from '@/models/errors';

import type { HistoryRows } from './rows';

export type SyncFailure = Extract<AppError, { kind: 'offline' | 'timeout' | 'server' }>;

/** Where the last sync stands. A running sync forgets the last failure, as a retry should. */
export type SyncView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'failed'; readonly error: AppError };

/** A read from the database rejected, which no retry of the bank sync fixes. */
export type ReadFailure = { readonly kind: 'unreadable' };

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

function syncFailure(sync: SyncView): SyncFailure | null {
  if (sync.kind !== 'failed') return null;
  switch (sync.error.kind) {
    case 'offline':
    case 'timeout':
    case 'server':
      return sync.error;
    default:
      return null;
  }
}

export function historyBody({ rows, synced, sync, filtered, unreadable }: BodyInput): HistoryBody {
  if (rows === undefined)
    return unreadable ? { kind: 'failed', error: { kind: 'unreadable' } } : { kind: 'loading' };
  if (rows.items.length > 0) return { kind: 'list', rows };
  if (synced === undefined && unreadable) return { kind: 'failed', error: { kind: 'unreadable' } };
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
