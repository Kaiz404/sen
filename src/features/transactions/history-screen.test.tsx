import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { toast } from '@/components/toast';
import { sessionStore } from '@/features/auth/session';
import { TxIdSchema } from '@/models/transaction';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { readSyncState, sync } from '@/services/sync';
import * as syncService from '@/services/sync';
import * as txRepo from '@/services/tx-repo';

import { arrivals, bank, markArrival, resetBank, syncProgress } from './data';
import { HistoryScreen } from './history-screen';
import { LAND_MS } from './pull/pull-refresh';
import { pullDown } from './pull/testing';

let mockDb: OpenDb;
let mockFocused = true;

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
const mockPush = jest.fn();
let mockNotice: 'missing_key' | 'corrupt' | null = null;
const mockDropped: boolean[] = [];
const mockShowAmounts = jest.fn(async () => {
  jest.requireActual('@/features/auth/session').sessionStore.setState({ amountsHidden: false });
  return { ok: true };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => mockFocused,
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  useDbResetNotice: () => mockNotice,
  takeDraftDropped: () => mockDropped.shift() ?? false,
  showAmounts: () => mockShowAmounts(),
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');

beforeEach(async () => {
  mockFocused = true;
  arrivals.setState({ after: null, added: null });
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  mockPush.mockClear();
  mockNotice = null;
  mockDropped.length = 0;
  clearPrefs();
  sessionStore.setState({ amountsHidden: true });
  writePref('demo.datasetSize', 20);
  writePref('demo.newOnRefresh', false);
  queryClient.clear();
  mockDb = await openTestDb();
});
afterEach(() => jest.useRealTimers());

const renderHistory = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );

const LONG = { timeout: 4000 };

test('search "entral" through the screen keeps only the KL Sentral rows', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'entral');

  expect(await screen.findByText('2 RESULTS')).toBeOnTheScreen();
  expect(screen.getByText('Grab ride to KL Sentral')).toBeOnTheScreen();
  expect(screen.getByText('Rapid KL, KL Sentral')).toBeOnTheScreen();
  expect(screen.queryByText('Tealive')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('month-card')).not.toBeOnTheScreen();
});

test.each([
  ['offline', 2, "Can't load your history", 4000],
  ['server', 2, 'Something broke on our side', 4000],
  ['timeout', 1, 'Taking too long', 12000],
] as const)(
  'a first sync that fails %s is tried %i times, then shows "%s"',
  async (next, calls, title, timeout) => {
    writePref('demo.next', next);
    const requests = jest.spyOn(bank, 'under');

    await renderHistory();

    expect(await screen.findByRole('header', { name: title }, { timeout })).toBeOnTheScreen();
    expect(requests).toHaveBeenCalledTimes(calls);
    requests.mockRestore();
  },
);

test('a simulated timeout keeps the skeleton for its 8 s deadline before the error shows', async () => {
  writePref('demo.next', 'timeout');
  const requests = jest.spyOn(bank, 'under');
  await renderHistory();
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));

  await act(() => jest.advanceTimersByTime(7500));
  expect(screen.queryByText('Taking too long')).not.toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(500));

  expect(await screen.findByText('Taking too long')).toBeOnTheScreen();
  requests.mockRestore();
});

test('bad rows are counted and never retried, and the good rows show', async () => {
  writePref('demo.next', 'bad_data');
  const requests = jest.spyOn(bank, 'under');

  await renderHistory();

  expect(await screen.findByText("2 items couldn't be read", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(requests).toHaveBeenCalledTimes(1);
  requests.mockRestore();
});

test('an offline fault covers one refresh: the banner shows, the fault turns itself off, and Retry recovers', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.next', 'offline');
  writePref('demo.newOnRefresh', true);

  await act(() => pullDown());

  expect(await screen.findByText("You're offline", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Showing history from 2:00 pm.')).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(readPref('demo.next')).toBe('normal');

  await act(() => jest.advanceTimersByTime(60_000));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
  expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
});

test('a fault picked while a refresh runs stays set, and the next refresh takes it', async () => {
  writePref('demo.slow', true);
  await renderHistory();
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();

  await act(() => pullDown());
  writePref('demo.next', 'server');
  await act(() => jest.advanceTimersByTime(3000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  expect(screen.queryByText('Something broke on our side')).not.toBeOnTheScreen();
  expect(readPref('demo.next')).toBe('server');

  await act(() => jest.advanceTimersByTime(LAND_MS));
  writePref('demo.slow', false);
  await act(() => pullDown());

  expect(await screen.findByText('Something broke on our side', undefined, LONG)).toBeOnTheScreen();
  expect(readPref('demo.next')).toBe('normal');
});

test('a bank reset runs the first sync again, even after a first sync that failed', async () => {
  writePref('demo.next', 'offline');
  await renderHistory();
  expect(await screen.findByText("Can't load your history", undefined, LONG)).toBeOnTheScreen();

  writePref('demo.datasetSize', 1000);
  await act(() => resetBank(mockDb));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  expect(await readSyncState(mockDb)).toEqual({
    cursor: 1000,
    syncedAt: expect.any(String),
    complete: true,
  });
});

test('a bank reset in the middle of a slow sync leaves only the new dataset, and History syncs it afresh', async () => {
  writePref('demo.datasetSize', 1000);
  writePref('demo.slow', true);
  writePref('demo.newOnRefresh', true);
  await renderHistory();
  await waitFor(async () => expect((await readSyncState(mockDb)).cursor).toBe(500), LONG);

  writePref('demo.datasetSize', 20);
  writePref('demo.slow', false);
  await act(() => resetBank(mockDb));
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(3000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());

  const ids = await mockDb.all("SELECT id FROM tx WHERE source = 'bank' ORDER BY id");
  expect(ids.map((r) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => `bk-${i + 1}`).sort());
  expect((await readSyncState(mockDb)).cursor).toBe(20);
});

test('a failed first load fills the screen, says the fault is simulated, and links to the reviewer controls', async () => {
  writePref('demo.next', 'offline');
  await renderHistory();

  expect(await screen.findByText("Can't load your history", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('NO CONNECTION · SIMULATED')).toBeOnTheScreen();
  expect(screen.queryByTestId('history-list')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('link', { name: 'Reviewer settings' }));

  expect(mockPush).toHaveBeenCalledWith('/settings?focus=reviewers');
});

test('the fault banner says the fault is simulated and links to the reviewer controls', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.next', 'server');

  await act(() => pullDown());
  expect(await screen.findByText('Something broke on our side', undefined, LONG)).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('link', { name: 'Simulated fault. Change it in Settings' }),
  );

  expect(mockPush).toHaveBeenCalledWith('/settings?focus=reviewers');
});

test('a row the Add flow marked keeps its slide-in until History is back in front, then drops it after 900 ms', async () => {
  mockFocused = false;
  const { rerender } = await renderHistory();
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();

  await act(() => markArrival(TxIdSchema.parse('bk-3')));
  await act(() => jest.advanceTimersByTime(2000));
  expect(arrivals.getState().added).toBe('bk-3');

  mockFocused = true;
  await rerender(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
  await act(() => jest.advanceTimersByTime(899));
  expect(arrivals.getState().added).toBe('bk-3');

  await act(() => jest.advanceTimersByTime(1));
  expect(arrivals.getState().added).toBeNull();
});

test('a screen reader can refresh without the pull gesture', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.newOnRefresh', true);

  const list = screen.getByTestId('history-list');
  expect(list.props.accessibilityActions).toEqual([{ name: 'refresh', label: 'Refresh' }]);
  await act(() => {
    fireEvent(list, 'accessibilityAction', { nativeEvent: { actionName: 'refresh' } });
  });

  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
});

test('while the undo toast shows, the list ends above the lifted Add key', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  const footer = () => screen.getByTestId('history-footer');
  expect(footer()).toHaveStyle({ paddingBottom: 104 });

  await act(async () => {
    toast.show({ title: 'Added', detail: 'Lunch with Hafiz, cash · stored encrypted' });
  });
  expect(footer()).toHaveStyle({ paddingBottom: 196 });

  await act(async () => toast.hide());
  expect(footer()).toHaveStyle({ paddingBottom: 104 });
});

test('a slide-in marked before a lock does not wait to play after the unlock', async () => {
  mockFocused = false;
  const { unmount } = await renderHistory();
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  await act(() => markArrival(TxIdSchema.parse('bk-3')));

  await unmount();

  expect(arrivals.getState().added).toBeNull();
});

test('a history read that fails shows "Sen couldn\'t read your history", and Retry reads it again', async () => {
  const read = jest.spyOn(txRepo, 'readPage').mockRejectedValue(new Error('disk'));

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: "Sen couldn't read your history" }, LONG),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('history-skeleton')).not.toBeOnTheScreen();

  read.mockRestore();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
});

test('reads that fail after a first sync leave Retry, not the skeleton', async () => {
  const realPage = txRepo.readPage;
  const realState = syncService.readSyncState;
  let pageReads = 0;
  let stateReads = 0;
  const page = jest.spyOn(txRepo, 'readPage').mockImplementation((...args) => {
    if (++pageReads > 1) return Promise.reject(new Error('disk'));
    return realPage(...args);
  });
  const state = jest.spyOn(syncService, 'readSyncState').mockImplementation((...args) => {
    if (++stateReads > 1) return Promise.reject(new Error('disk'));
    return realState(...args);
  });

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: "Sen couldn't read your history" }, LONG),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('history-skeleton')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  page.mockRestore();
  state.mockRestore();
});

test.each([
  ['missing_key', "Sen couldn't find its key on this phone, so it started a fresh, empty store."],
  ['corrupt', "Sen couldn't read its saved data, so it started a fresh store."],
] as const)('the %s reset notice says rows added on this phone are lost', async (reason, lead) => {
  mockNotice = reason;

  await renderHistory();

  expect(
    await screen.findByText(
      `${lead} Your bank history syncs back. Transactions you added here couldn't be recovered.`,
    ),
  ).toBeOnTheScreen();
  mockNotice = null;
});

test.each([
  ['lockout', 'Too many tries. Use your device passcode.'],
  ['not_set_up', 'Fingerprint is off. Your device passcode still works.'],
  ['unknown', 'Something went wrong with the check. Try again.'],
] as const)('Show amounts refused for %s says why', async (reason, title) => {
  const shown = jest.spyOn(toast, 'show');
  mockShowAmounts.mockResolvedValueOnce({ ok: false, reason } as never);
  await renderHistory();
  await fireEvent.press(await screen.findByRole('button', { name: 'Show amounts' }));

  await waitFor(() => expect(shown).toHaveBeenCalledWith({ title }));
  shown.mockRestore();
});

test('Show amounts cancelled stays silent', async () => {
  const shown = jest.spyOn(toast, 'show');
  mockShowAmounts.mockResolvedValueOnce({ ok: false, reason: 'cancelled' } as never);
  await renderHistory();
  await fireEvent.press(await screen.findByRole('button', { name: 'Show amounts' }));
  await act(() => Promise.resolve());

  expect(shown).not.toHaveBeenCalled();
  shown.mockRestore();
});

test('History says once that a lock dropped the add draft', async () => {
  const shown = jest.spyOn(toast, 'show');
  mockDropped.push(true);

  await renderHistory();

  expect(shown).toHaveBeenCalledWith({
    title: 'Sen locked while you were adding.',
    detail: 'Nothing was saved.',
  });
  shown.mockRestore();
});

test('a first sync that throws instead of returning shows the storage error, and Retry recovers', async () => {
  const run = jest.spyOn(syncService, 'sync').mockRejectedValueOnce(new Error('disk full'));

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: "Can't save to this phone" }, LONG),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Sen couldn't save to this phone. Free some space, then try again."),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Reviewer settings')).not.toBeOnTheScreen();
  expect(run).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  run.mockRestore();
});

test('a refresh that throws over a list is a banner with its own copy and no reviewer link', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  const run = jest.spyOn(syncService, 'sync').mockRejectedValueOnce(new Error('disk full'));

  await fireEvent(screen.getByTestId('history-list'), 'refresh');

  expect(
    await screen.findByText("Sen couldn't save to this phone", undefined, LONG),
  ).toBeOnTheScreen();
  expect(screen.getByText('Free some space, then try again.')).toBeOnTheScreen();
  expect(screen.queryByText('Simulated · Change in Settings')).not.toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  run.mockRestore();
});

const loadedRows = () =>
  queryClient
    .getQueriesData<{ pages: { rows: unknown[] }[] }>({ queryKey: ['tx', 'pages'] })
    .flatMap(([, data]) => data?.pages ?? [])
    .reduce((n, page) => n + page.rows.length, 0);

test('opening History after an interrupted first sync quietly pulls the rest', async () => {
  const real = bank.under({ next: 'normal', size: 20, slow: false, newOnRefresh: false });
  let pages = 0;
  const interrupted = {
    fetchPage: async (request: Parameters<typeof real.fetchPage>[0]) =>
      ++pages > 1 ? ({ ok: false, error: { kind: 'offline' } } as const) : real.fetchPage(request),
  };
  await sync(mockDb, interrupted, { pageSize: 5 });
  expect((await readSyncState(mockDb)).cursor).toBe(5);
  const requests = jest.spyOn(bank, 'under');

  await renderHistory();

  await waitFor(async () => expect((await readSyncState(mockDb)).cursor).toBe(20), LONG);
  await waitFor(() => expect(loadedRows()).toBe(20), LONG);
  expect(screen.queryByTestId('sync-banner')).not.toBeOnTheScreen();
  expect(screen.queryByText(/Updated just now/)).not.toBeOnTheScreen();
  expect(requests).toHaveBeenCalledTimes(1);
  requests.mockRestore();
});

test('unlocking a finished history sends no bank request and leaves an armed fault armed', async () => {
  await sync(mockDb, bank.under({ next: 'normal', size: 20, slow: false, newOnRefresh: false }));
  writePref('demo.next', 'offline');
  const requests = jest.spyOn(bank, 'under');

  await renderHistory();

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  await act(() => Promise.resolve());
  expect(requests).not.toHaveBeenCalled();
  expect(readPref('demo.next')).toBe('offline');
  expect(screen.queryByTestId('sync-banner')).not.toBeOnTheScreen();
  requests.mockRestore();
});
