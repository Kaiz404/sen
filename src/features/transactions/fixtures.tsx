import { type ReactNode, useEffect } from 'react';

import { toast } from '@/components/toast';
import type { MaskedRow } from '@/models/transaction';
import type { Flow } from '@/services/tx-repo';

import type { HistoryBody } from './body';
import { BOARD_ROWS, BOARD_TODAY, boardCounts, boardRevealed } from './fixture-data';
import { type HistoryActions, HistoryView, type HistoryViewProps } from './history-view';
import { buildHistoryRows, NO_ARRIVAL } from './rows';

const noop = () => {};

export const NO_ACTIONS: HistoryActions = {
  onSearch: noop,
  onFlow: noop,
  onShow: noop,
  onHide: noop,
  onRefresh: noop,
  onPullSettled: noop,
  onRetry: noop,
  onEndReached: noop,
  onAdd: noop,
  onPrivacy: noop,
  onSettings: noop,
  onReviewerSettings: noop,
  onLock: noop,
  onOpen: noop,
  onDismissNotice: noop,
};

const list = (rows: readonly MaskedRow[]): HistoryBody => ({
  kind: 'list',
  rows: buildHistoryRows(rows, { today: BOARD_TODAY, complete: true }),
});

const BASE: HistoryViewProps = {
  today: BOARD_TODAY,
  body: list(BOARD_ROWS),
  hidden: true,
  search: '',
  flow: 'all',
  monthCounts: boardCounts(BOARD_ROWS),
  resultCounts: undefined,
  banner: null,
  skipped: 0,
  notice: null,
  pull: 'idle',
  arrival: NO_ARRIVAL,
  updated: null,
  biometric: 'faceId',
  revealed: null,
  actions: NO_ACTIONS,
};

/** History with the undo toast up, so the Add key shows lifted clear of it. */
function WithToast(): ReactNode {
  useEffect(() => {
    const id = toast.show({
      title: 'Added',
      detail: 'Lunch with Hafiz, cash · stored encrypted',
      action: { label: 'Undo', accessibilityLabel: 'Undo add', icon: 'undo', onPress: noop },
      ttl: 10 * 60_000,
    });
    return () => toast.hide(id);
  }, []);
  return <HistoryView {...BASE} />;
}

const GRAB = BOARD_ROWS.filter((r) => r.description.toLowerCase().includes('grab'));
const byFlow = (flow: Flow) =>
  BOARD_ROWS.filter((r) => flow === 'all' || (flow === 'in') === (r.type === 'credit'));

export const HISTORY_STATES = {
  loading: () => <HistoryView {...BASE} body={{ kind: 'loading' }} monthCounts={undefined} />,
  empty: () => <HistoryView {...BASE} body={{ kind: 'empty' }} />,
  masked: () => <HistoryView {...BASE} />,
  'add-key': () => <HistoryView {...BASE} />,
  'add-key-lifted': () => <WithToast />,
  shown: () => <HistoryView {...BASE} hidden={false} revealed={boardRevealed(BOARD_ROWS)} />,
  search: () => (
    <HistoryView {...BASE} search="grab" body={list(GRAB)} resultCounts={boardCounts(GRAB)} />
  ),
  'search-shown': () => (
    <HistoryView
      {...BASE}
      search="grab"
      body={list(GRAB)}
      resultCounts={boardCounts(GRAB)}
      hidden={false}
      revealed={boardRevealed(GRAB)}
    />
  ),
  'no-results': () => (
    <HistoryView
      {...BASE}
      search="Starbucks"
      body={{ kind: 'no-results' }}
      resultCounts={boardCounts([])}
    />
  ),
  'in-filter': () => (
    <HistoryView
      {...BASE}
      flow="in"
      body={list(byFlow('in'))}
      monthCounts={boardCounts(byFlow('in'))}
    />
  ),
  offline: () => <HistoryView {...BASE} banner={{ kind: 'offline', since: '8:40 am' }} />,
  failed: () => <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'offline' } }} />,
  'failed-storage': () => (
    <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'storage' } }} />
  ),
  'failed-unknown': () => (
    <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'unknown' } }} />
  ),
  'unknown-banner': () => <HistoryView {...BASE} banner={{ kind: 'unknown', since: '8:40 am' }} />,
  'storage-banner': () => <HistoryView {...BASE} banner={{ kind: 'storage', since: '8:40 am' }} />,
  'failed-server': () => (
    <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'server' } }} />
  ),
  unreadable: () => (
    <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'unreadable' } }} />
  ),
  'bad-data': () => <HistoryView {...BASE} skipped={2} />,
  'db-reset': () => <HistoryView {...BASE} notice="missing_key" />,
  refreshing: () => <HistoryView {...BASE} pull="loading" pullStill />,
  updated: () => <HistoryView {...BASE} updated={1} />,
} satisfies Record<string, () => ReactNode>;
