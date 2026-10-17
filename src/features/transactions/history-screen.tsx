import { useIsFocused, useRouter } from 'expo-router';
import { type ReactNode, useDeferredValue, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useStore } from 'zustand';

import {
  dismissDbResetNotice,
  hideAmounts,
  lockNow,
  showAmounts,
  useAmountsHidden,
  useBiometric,
  useDb,
  useDbResetNotice,
} from '@/features/auth';
import { malaysiaDay, toInstant } from '@/models/day';
import { DUR } from '@/motion/tokens';
import { playHaptic } from '@/services/haptics';
import { mark } from '@/services/perf';
import type { Flow } from '@/services/tx-repo';

import { historyBody, syncNotes } from './body';
import {
  arrivals,
  bankEpoch,
  clearAddedArrival,
  monthSoFarRange,
  syncView,
  useHistoryData,
  useSync,
} from './data';
import { HistoryView } from './history-view';
import type { PullStatus } from './pull/pull-refresh';
import { clockText } from './rows';

const PILL_MS = 2500;

export function HistoryScreen(): ReactNode {
  const db = useDb();
  const router = useRouter();
  const hidden = useAmountsHidden();
  const notice = useDbResetNotice();
  const biometric = useBiometric().kind;
  const [search, setSearch] = useState('');
  const [flow, setFlow] = useState<Flow>('all');
  const [updated, setUpdated] = useState<number | null>(null);
  const [pull, setPull] = useState<PullStatus>('idle');
  const deferredSearch = useDeferredValue(search);

  const today = malaysiaDay(toInstant(new Date()));
  const data = useHistoryData(db, {
    filter: { flow, search: deferredSearch },
    month: monthSoFarRange(today),
    today,
    hidden,
  });
  const syncing = useSync(db, data.newest);
  const after = useStore(arrivals, (s) => s.after);
  const added = useStore(arrivals, (s) => s.added);
  const focused = useIsFocused();
  // A row added on the Add screen lands while History is covered, so it slides in once History is back.
  const arrival = { after, added: focused ? added : null };
  const sliding = focused && added !== null;
  useEffect(() => {
    if (!sliding) return;
    const timer = setTimeout(clearAddedArrival, DUR.enter);
    return () => clearTimeout(timer);
  }, [sliding]);

  const epoch = useStore(bankEpoch, (s) => s.epoch);

  const hasRows = data.rows !== undefined;
  useEffect(() => mark('history.mounted'), []);
  useEffect(() => {
    if (hasRows) mark('history.rows');
  }, [hasRows]);

  const { mutate } = syncing;
  const unsynced = data.synced === false;
  // Runs once each time the database has no cursor: at first unlock and after each bank reset. A first sync
  // that failed waits for Retry instead of looping.
  useEffect(() => {
    if (unsynced) mutate('first');
  }, [unsynced, epoch, mutate]);

  useEffect(() => {
    if (updated === null) return;
    const timer = setTimeout(() => setUpdated(null), PILL_MS);
    return () => clearTimeout(timer);
  }, [updated]);

  // The promise belongs to this call's own mutation, so a later `mutate` (the first sync after a bank reset)
  // cannot orphan it the way per-call callbacks are.
  const refresh = (trigger: 'pull' | 'retry') => {
    const pulled = trigger === 'pull';
    if (pulled) setPull('loading');
    syncing.mutateAsync(trigger).then(
      (summary) => {
        // A pull's landing moment plays the haptic itself, at the touchdown.
        if (pulled) setPull((now) => (now === 'loading' ? 'landed' : now));
        else playHaptic('refreshLanded');
        setUpdated(summary.received);
      },
      () => {
        if (pulled) setPull('idle');
        playHaptic('networkError');
      },
    );
  };

  // Backstop: a pull cannot be loading while no sync runs.
  const shownPull = pull === 'loading' && !syncing.isPending ? 'idle' : pull;

  const sync = syncView(syncing);
  const body = historyBody({
    rows: data.rows,
    synced: data.synced,
    sync,
    filtered: deferredSearch.trim() !== '' || flow !== 'all',
  });
  const notes = syncNotes(sync, body, data.syncedAt === null ? null : clockText(data.syncedAt));

  return (
    <HistoryView
      today={today}
      body={body}
      hidden={hidden}
      search={search}
      flow={flow}
      monthCounts={data.monthTotals}
      resultCounts={data.results}
      banner={notes.banner}
      skipped={notes.skipped + data.skipped}
      notice={notice}
      pull={shownPull}
      arrival={arrival}
      updated={updated}
      biometric={biometric}
      revealed={data.revealed}
      actions={{
        onSearch: setSearch,
        onFlow: (next) => {
          playHaptic('segment');
          setFlow(next);
        },
        onShow: () => {
          // Fired here, not by Sen's Reveal, which a scroll or the background can hold back.
          void showAmounts().then((outcome) => {
            if (!outcome.ok) return;
            playHaptic('reveal');
            AccessibilityInfo.announceForAccessibility('Amounts shown');
          });
        },
        onHide: () => {
          hideAmounts();
          playHaptic('hideNow');
          AccessibilityInfo.announceForAccessibility('Amounts hidden');
        },
        onRefresh: () => refresh('pull'),
        onPullSettled: () => setPull('idle'),
        onRetry: () => refresh('retry'),
        onEndReached: data.loadMore,
        onAdd: () => router.push('/add'),
        onSettings: () => router.push('/settings'),
        onReviewerSettings: () => router.push('/settings?focus=reviewers'),
        onLock: lockNow,
        onOpen: (id) => router.push(`/transaction/${id}`),
        onDismissNotice: dismissDbResetNotice,
      }}
    />
  );
}
