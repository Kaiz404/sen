import { useRouter } from 'expo-router';
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
import { DayKeySchema, malaysiaDay, toInstant } from '@/models/day';
import { playHaptic } from '@/services/haptics';
import type { Flow } from '@/services/tx-repo';

import { historyBody, syncNotes } from './body';
import { arrivals, syncView, useHistoryData, useSync } from './data';
import { HistoryView } from './history-view';
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
  const deferredSearch = useDeferredValue(search);

  const today = malaysiaDay(toInstant(new Date()));
  const data = useHistoryData(db, {
    filter: { flow, search: deferredSearch },
    month: { from: DayKeySchema.parse(`${today.slice(0, 8)}01`), to: today },
    today,
    hidden,
  });
  const syncing = useSync(db, data.newest);
  const arrival = useStore(arrivals, (s) => s.after);

  const { mutate } = syncing;
  useEffect(() => {
    if (data.synced === false && syncing.status === 'idle') mutate('first');
  }, [data.synced, syncing.status, mutate]);

  useEffect(() => {
    if (updated === null) return;
    const timer = setTimeout(() => setUpdated(null), PILL_MS);
    return () => clearTimeout(timer);
  }, [updated]);

  const refresh = (trigger: 'pull' | 'retry') =>
    mutate(trigger, {
      onSuccess: (summary) => {
        playHaptic('refreshLanded');
        setUpdated(summary.received);
      },
      onError: () => playHaptic('networkError'),
    });

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
      refreshing={syncing.isPending && syncing.variables === 'pull'}
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
        onRetry: () => refresh('retry'),
        onEndReached: data.loadMore,
        onAdd: () => router.push('/add'),
        onSettings: () => router.push('/settings'),
        onLock: lockNow,
        onOpen: (id) => router.push(`/transaction/${id}`),
        onDismissNotice: dismissDbResetNotice,
      }}
    />
  );
}
