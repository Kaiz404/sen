import { type BodyInput, historyBody, type SyncView, syncNotes } from './body';
import { BOARD_ROWS, BOARD_TODAY } from './fixture-data';
import { buildHistoryRows } from './rows';

const LIST = buildHistoryRows(BOARD_ROWS, { today: BOARD_TODAY, complete: true });
const NONE = buildHistoryRows([], { today: BOARD_TODAY, complete: true });

const idle: SyncView = { kind: 'idle' };
const running: SyncView = { kind: 'running' };
const offline: SyncView = { kind: 'failed', error: { kind: 'offline' } };
const badData: SyncView = { kind: 'failed', error: { kind: 'invalid_data', skipped: 2 } };

const at = (input: Partial<BodyInput>): string =>
  historyBody({ rows: NONE, synced: true, sync: idle, filtered: false, ...input }).kind;

test.each<[string, Partial<BodyInput>, string]>([
  ['no page read yet', { rows: undefined }, 'loading'],
  ['the first sync is running', { synced: false, sync: running }, 'loading'],
  ['the sync state is still being read', { synced: undefined }, 'loading'],
  ['the first sync failed', { synced: false, sync: offline }, 'failed'],
  ['synced and nothing there', {}, 'empty'],
  ['a search with no match', { filtered: true }, 'no-results'],
  [
    'a search with no match after a failed refresh',
    { filtered: true, sync: offline },
    'no-results',
  ],
  ['rows, after a failed refresh', { rows: LIST, sync: offline }, 'list'],
  ['rows, while the first sync still runs', { rows: LIST, synced: false, sync: running }, 'list'],
])('%s shows %s', (_name, input, expected) => {
  expect(at(input)).toBe(expected);
});

test('a failed sync over a list is a banner with the last sync time, and bad rows are counted', () => {
  const list = historyBody({ rows: LIST, synced: true, sync: offline, filtered: false });
  const failed = historyBody({ rows: NONE, synced: false, sync: offline, filtered: false });

  expect(syncNotes(offline, list, '8:40 am')).toEqual({
    banner: { kind: 'offline', since: '8:40 am' },
    skipped: 0,
  });
  expect(syncNotes(offline, failed, '8:40 am')).toEqual({ banner: null, skipped: 0 });
  expect(syncNotes(badData, list, null)).toEqual({ banner: null, skipped: 2 });
});
