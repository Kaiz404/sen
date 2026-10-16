import type { ReactNode } from 'react';

import type { MaskedRow } from '@/models/transaction';
import type { Flow } from '@/services/tx-repo';

import type { HistoryBody } from './body';
import { BOARD_ROWS, BOARD_TODAY, boardCounts, boardRevealed } from './fixture-data';
import { type HistoryActions, HistoryView, type HistoryViewProps } from './history-view';
import { buildHistoryRows } from './rows';

const noop = () => {};

export const NO_ACTIONS: HistoryActions = {
  onSearch: noop,
  onFlow: noop,
  onShow: noop,
  onHide: noop,
  onRefresh: noop,
  onRetry: noop,
  onEndReached: noop,
  onAdd: noop,
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
  refreshing: false,
  arrival: null,
  updated: null,
  biometric: 'faceId',
  revealed: null,
  actions: NO_ACTIONS,
};

const GRAB = BOARD_ROWS.filter((r) => r.description.toLowerCase().includes('grab'));
const byFlow = (flow: Flow) =>
  BOARD_ROWS.filter((r) => flow === 'all' || (flow === 'in') === (r.type === 'credit'));

export const HISTORY_STATES = {
  loading: () => <HistoryView {...BASE} body={{ kind: 'loading' }} monthCounts={undefined} />,
  empty: () => <HistoryView {...BASE} body={{ kind: 'empty' }} />,
  masked: () => <HistoryView {...BASE} />,
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
  'failed-server': () => (
    <HistoryView {...BASE} body={{ kind: 'failed', error: { kind: 'server' } }} />
  ),
  'bad-data': () => <HistoryView {...BASE} skipped={2} />,
  'db-reset': () => <HistoryView {...BASE} notice="missing_key" />,
  refreshing: () => <HistoryView {...BASE} refreshing updated={null} />,
  updated: () => <HistoryView {...BASE} updated={1} />,
} satisfies Record<string, () => ReactNode>;
