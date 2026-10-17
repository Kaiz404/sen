import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { onArrive } from '@/features/auth';
import { type DayKey, DayKeySchema, malaysiaDay, toInstant } from '@/models/day';
import { type AppError, isRetryable, toAppError } from '@/models/errors';
import type { PrefValue } from '@/models/prefs';
import type { MaskedRow, TxId } from '@/models/transaction';
import { type BankScenario, createMockBank } from '@/services/bank-api';
import type { Db } from '@/services/db';
import { logEvent } from '@/services/logger';
import { readPref, writePref } from '@/services/prefs';
import { QK, queryClient } from '@/services/query-client';
import { readSyncState, resetBankRows, sync, type SyncSummary } from '@/services/sync';
import {
  type DayRange,
  type PageCursor,
  readPage,
  readRevealedAmounts,
  readRevealedDayNets,
  readRevealedTotals,
  readTotals,
  type TxFilter,
} from '@/services/tx-repo';
import { DUR } from '@/motion/tokens';

import type { SyncView } from './body';
import type { Revealed } from './reveal';
import { type Arrival, buildHistoryRows, type HistoryRows, NO_ARRIVAL } from './rows';

/** The in-app bank. Each sync reads the reviewer's `demo.*` settings once, in `readScenario`. */
export const bank = createMockBank();

function readScenario(): BankScenario {
  return {
    next: readPref('demo.next'),
    size: readPref('demo.datasetSize'),
    slow: readPref('demo.slow'),
    newOnRefresh: readPref('demo.newOnRefresh'),
  };
}

export const historyKeys = {
  pages: (filter: TxFilter) => [...QK.tx, 'pages', filter] as const,
  syncState: [...QK.tx, 'sync-state'] as const,
  totals: (filter: TxFilter, days: DayRange | null) => [...QK.tx, 'totals', filter, days] as const,
  amounts: (filter: TxFilter, through: PageCursor | null) =>
    [...QK.revealed, 'amounts', filter, through] as const,
  revealedTotals: (filter: TxFilter, days: DayRange | null) =>
    [...QK.revealed, 'totals', filter, days] as const,
  nets: (filter: TxFilter, days: DayRange | null) =>
    [...QK.revealed, 'nets', filter, days] as const,
};

/** The reads History opens with, shared by the screen and the prefetch, so their keys never drift. */
const queries = {
  pages: (db: Db, filter: TxFilter) =>
    infiniteQueryOptions({
      queryKey: historyKeys.pages(filter),
      queryFn: ({ pageParam }) => readPage(db, { filter, after: pageParam }),
      initialPageParam: null as PageCursor | null,
      getNextPageParam: (last) => last.next,
    }),
  syncState: (db: Db) =>
    queryOptions({ queryKey: historyKeys.syncState, queryFn: () => readSyncState(db) }),
  monthTotals: (db: Db, filter: TxFilter, month: DayRange) =>
    queryOptions({
      queryKey: historyKeys.totals(filter, month),
      queryFn: () => readTotals(db, { filter, days: month }),
    }),
  revealedMonth: (db: Db, filter: TxFilter, month: DayRange) =>
    queryOptions({
      queryKey: historyKeys.revealedTotals(filter, month),
      queryFn: () => readRevealedTotals(db, { filter, days: month }),
    }),
};

/** The month card's range: the first of `today`'s month through `today`. */
export function monthSoFarRange(today: DayKey): DayRange {
  return { from: DayKeySchema.parse(`${today.slice(0, 8)}01`), to: today };
}

const OPENING_FILTER: TxFilter = { flow: 'all', search: '' };

/**
 * Starts the reads History opens with, as an unlock passes. Lock holds for Sen's Unlock moment before
 * History mounts, so the reads run under it instead of after it.
 */
export function prefetchHistory(db: Db, now: Date): void {
  const month = monthSoFarRange(malaysiaDay(toInstant(now)));
  void queryClient.prefetchInfiniteQuery(queries.pages(db, OPENING_FILTER));
  void queryClient.prefetchQuery(queries.syncState(db));
  void queryClient.prefetchQuery(queries.monthTotals(db, OPENING_FILTER, month));
}

/** The app root calls this once, so every unlock starts History's reads. */
export function useHistoryPrefetch(): void {
  useEffect(() => onArrive((db) => prefetchHistory(db, new Date())), []);
}

/** `catchup` is the quiet sync on open. It slides nothing in and shows nothing unless it fails. */
export type SyncTrigger = 'first' | 'catchup' | 'pull' | 'retry';

/**
 * Rows that slide in once: those newer than `after`, and the row `added`. The list reads this one store, so a
 * row never holds the flag and a recycled cell never replays it.
 */
export const arrivals = create<Arrival>(() => NO_ARRIVAL);

/** The add flow calls this before its refetch lands. History plays the slide-in once it is on screen again. */
export function markArrival(id: TxId): void {
  arrivals.setState({ added: id });
}

export function clearAddedArrival(): void {
  arrivals.setState({ added: null });
}

function cursorOf(row: MaskedRow | undefined): PageCursor | null {
  return row === undefined ? null : { postedAt: row.postedAt, id: row.id };
}

/** How far the running sync has got, or null when none runs. `total` is known only for a first sync. */
export type SyncProgress = { readonly received: number; readonly total: number | null } | null;

export const syncProgress = create<{ readonly progress: SyncProgress }>(() => ({ progress: null }));

export function useSyncProgress(): SyncProgress {
  return syncProgress((s) => s.progress);
}

/** Bumped by `resetBank`, so History runs a first sync again even when the last one failed. */
export const bankEpoch = create<{ readonly epoch: number }>(() => ({ epoch: 0 }));

/**
 * Deletes the bank rows and rewinds the cursor. Rows added on the phone stay. History then syncs afresh.
 * `afterRows` runs once the rows are gone and before that sync starts, so a pref it writes shapes the sync.
 * When the delete fails, it never runs.
 */
export async function resetBank(db: Db, afterRows?: () => void): Promise<void> {
  await resetBankRows(db);
  afterRows?.();
  bankEpoch.setState((s) => ({ epoch: s.epoch + 1 }));
  await queryClient.invalidateQueries({ queryKey: QK.tx });
}

type DemoNext = PrefValue<'demo.next'>;

/**
 * A reviewer fault covers one history request, its pages and its automatic retry, then goes back to normal,
 * unless the reviewer picked something else while the request ran.
 */
function settleFault(armed: DemoNext | undefined): void {
  if (armed !== undefined && armed !== 'normal' && readPref('demo.next') === armed)
    writePref('demo.next', 'normal');
}

export function useSync(db: Db, newest: MaskedRow | undefined) {
  const client = useQueryClient();
  return useMutation<SyncSummary, AppError, SyncTrigger, DemoNext>({
    mutationKey: [...QK.tx, 'sync'],
    onMutate: (trigger) => {
      const total = trigger === 'first' ? readPref('demo.datasetSize') : null;
      syncProgress.setState({ progress: { received: 0, total } });
      return readPref('demo.next');
    },
    mutationFn: async () => {
      const result = await sync(db, bank.under(readScenario()), {
        onProgress: (received) =>
          syncProgress.setState((s) => ({
            progress: { received, total: s.progress?.total ?? null },
          })),
      }).catch((thrown: unknown) => {
        logEvent('sync.failed.storage');
        throw toAppError(thrown);
      });
      if (!result.ok) throw result.error;
      return result.data;
    },
    // A timeout has already made the user wait its whole deadline, so it goes straight to them.
    retry: (failures, error) => failures < 1 && isRetryable(error) && error.kind !== 'timeout',
    onSettled: (_data, _error, _trigger, armed) => {
      syncProgress.setState({ progress: null });
      settleFault(armed);
    },
    onSuccess: async (summary, trigger) => {
      const before = cursorOf(newest);
      const slides =
        (trigger === 'pull' || trigger === 'retry') && summary.received > 0 && before !== null;
      if (slides) arrivals.setState({ after: before });
      await client.invalidateQueries({ queryKey: QK.tx });
      if (slides) setTimeout(() => arrivals.setState({ after: null }), DUR.enter);
    },
    onError: () => client.invalidateQueries({ queryKey: QK.tx }),
  });
}

export function syncView(mutation: {
  readonly status: 'idle' | 'pending' | 'success' | 'error';
  readonly error: AppError | null;
}): SyncView {
  if (mutation.status === 'pending') return { kind: 'running' };
  if (mutation.status === 'error' && mutation.error !== null)
    return { kind: 'failed', error: mutation.error };
  return { kind: 'idle' };
}

export type HistoryQuery = {
  readonly filter: TxFilter;
  readonly month: DayRange;
  readonly today: DayKey;
  readonly hidden: boolean;
};

/** Every read the History screen makes. While `hidden`, none of them selects an amount. */
export function useHistoryData(db: Db, { filter, month, today, hidden }: HistoryQuery) {
  const pages = useInfiniteQuery({
    ...queries.pages(db, filter),
    placeholderData: keepPreviousData,
  });
  const syncState = useQuery(queries.syncState(db));

  const loaded = useMemo(() => pages.data?.pages.flatMap((page) => page.rows), [pages.data]);
  const complete = pages.data !== undefined && !pages.hasNextPage;
  const rows = useMemo<HistoryRows | undefined>(
    () => (loaded === undefined ? undefined : buildHistoryRows(loaded, { today, complete })),
    [loaded, today, complete],
  );
  const skipped = pages.data?.pages.reduce((n, page) => n + page.skipped, 0) ?? 0;

  const first = loaded?.[0];
  const last = loaded?.[loaded.length - 1];
  const loadedDays: DayRange | null =
    first === undefined || last === undefined ? null : { from: last.day, to: first.day };
  const cardFilter: TxFilter = { flow: filter.flow, search: '' };
  const searching = filter.search.trim() !== '';

  const monthTotals = useQuery(queries.monthTotals(db, cardFilter, month));
  const results = useQuery({
    queryKey: historyKeys.totals(filter, null),
    queryFn: () => readTotals(db, { filter }),
    enabled: searching,
  });

  const through = cursorOf(last);
  const amounts = useQuery({
    queryKey: historyKeys.amounts(filter, through),
    queryFn: () => readRevealedAmounts(db, { filter, through: through! }),
    enabled: !hidden && through !== null,
    placeholderData: keepPreviousData,
  });
  const nets = useQuery({
    queryKey: historyKeys.nets(filter, loadedDays),
    queryFn: async () =>
      new Map(
        (await readRevealedDayNets(db, { filter, days: loadedDays! })).map((d) => [
          d.day,
          d.netMinor,
        ]),
      ),
    enabled: !hidden && loadedDays !== null,
    placeholderData: keepPreviousData,
  });
  const revealedMonth = useQuery({
    ...queries.revealedMonth(db, cardFilter, month),
    enabled: !hidden,
  });
  const revealedResults = useQuery({
    queryKey: historyKeys.revealedTotals(filter, null),
    queryFn: () => readRevealedTotals(db, { filter }),
    enabled: !hidden && searching,
  });

  const revealed = useMemo<Revealed | null>(
    () =>
      hidden || amounts.data === undefined
        ? null
        : {
            amounts: amounts.data,
            nets: nets.data,
            month: revealedMonth.data,
            results: revealedResults.data,
          },
    [hidden, amounts.data, nets.data, revealedMonth.data, revealedResults.data],
  );

  return {
    rows,
    newest: first,
    skipped,
    hasMore: pages.hasNextPage,
    loadMore: () => {
      if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage();
    },
    unreadable: pages.isError || syncState.isError,
    retryReads: () => {
      void pages.refetch();
      void syncState.refetch();
    },
    synced: syncState.data === undefined ? undefined : syncState.data.cursor > 0,
    interrupted:
      syncState.data === undefined
        ? undefined
        : syncState.data.cursor > 0 && !syncState.data.complete,
    syncedAt: syncState.data?.syncedAt ?? null,
    monthTotals: monthTotals.data,
    results: searching ? results.data : undefined,
    revealed,
  };
}
