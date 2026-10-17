import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { toast } from '@/components/toast';
import { playMoment, Sen } from '@/features/sen';
import { sessionStore } from '@/features/auth/session';
import { TxIdSchema } from '@/models/transaction';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { playHaptic } from '@/services/haptics';
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
  jest.mocked(playHaptic).mockClear();
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

test('the header question mark opens the privacy explainer, beside Settings', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'How Sen keeps amounts private' }));

  expect(mockPush).toHaveBeenCalledWith('/settings/privacy');
  expect(screen.getByRole('button', { name: 'Settings' })).toBeOnTheScreen();
});

const buzzes = () => jest.mocked(playHaptic).mock.calls.filter(([h]) => h === 'networkError');
const senFace = () =>
  (
    within(
      screen.getByTestId('sen-rig-history-failed', { includeHiddenElements: true }),
    ).getByTestId('sen-lk', { includeHiddenElements: true }).props.jestAnimatedProps.value
      .matrix as number[]
  ).slice(4);

test('a failed Retry keeps the full error up with Retry busy, buzzes once per failure, and a good Retry shows the list', async () => {
  writePref('demo.next', 'offline');
  await renderHistory();
  expect(await screen.findByText("Can't load your history", undefined, LONG)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(300));
  expect(buzzes()).toHaveLength(1);
  await act(() => jest.advanceTimersByTime(2000));

  writePref('demo.next', 'offline');
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  // The sync runs: no skeleton, the same error, and a Retry that says it is busy.
  expect(screen.getByText("Can't load your history")).toBeOnTheScreen();
  expect(screen.queryByTestId('history-skeleton')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeBusy();
  const rested = senFace();
  await act(() => jest.advanceTimersByTime(400));
  expect(screen.getByText("Can't load your history")).toBeOnTheScreen();
  expect(senFace()).not.toEqual(rested);

  await act(() => jest.advanceTimersByTime(6000));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled(), LONG);
  await act(() => jest.advanceTimersByTime(300));
  expect(screen.getByText("Can't load your history")).toBeOnTheScreen();
  expect(buzzes()).toHaveLength(2);

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  expect(buzzes()).toHaveLength(2);
});

test('a failed pull over a list buzzes once, from the banner path', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.next', 'offline');

  await act(() => pullDown());
  expect(await screen.findByText("You're offline", undefined, LONG)).toBeOnTheScreen();

  expect(buzzes()).toHaveLength(1);
});

test('covering History holds its own Sens still while another screen’s Sen carries on', async () => {
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
      <Sen id="other" pose="idle" size={60} />
    </QueryClientProvider>
  );
  const { rerender } = await render(tree());
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(100));
  expect(playMoment('month', 'blink')).toBe(true);
  await act(() => jest.advanceTimersByTime(300));

  mockFocused = false;
  await rerender(tree());
  expect(playMoment('month', 'blink')).toBe(false);
  expect(playMoment('other', 'blink')).toBe(true);
  await act(() => jest.advanceTimersByTime(300));

  mockFocused = true;
  await rerender(tree());
  expect(playMoment('month', 'blink')).toBe(true);
});

test('an unreadable history buzzes once on arrival, not on re-renders or refocus, and once per failed Retry', async () => {
  jest.spyOn(txRepo, 'readPage').mockRejectedValue(new Error('disk'));
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>
  );
  const { rerender } = await render(tree());
  expect(
    await screen.findByRole('header', { name: "Sen couldn't read your history" }, LONG),
  ).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(2500));
  expect(buzzes()).toHaveLength(1);

  mockFocused = false;
  await rerender(tree());
  mockFocused = true;
  await rerender(tree());
  await act(() => jest.advanceTimersByTime(2500));
  expect(buzzes()).toHaveLength(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(buzzes()).toHaveLength(2), LONG);
  await act(() => jest.advanceTimersByTime(2500));
  expect(buzzes()).toHaveLength(2);
  jest.mocked(txRepo.readPage).mockRestore();
});

test('a failure with no full error to show still buzzes once: skipped rows on a pull over an empty history', async () => {
  const run = jest
    .spyOn(syncService, 'sync')
    .mockResolvedValueOnce({ ok: true, value: { received: 0 } } as never)
    .mockRejectedValueOnce({ kind: 'invalid_data', skipped: 2 });
  await renderHistory();
  await act(() => jest.advanceTimersByTime(500));
  const before = buzzes().length;

  await act(() => pullDown());
  await waitFor(() => expect(buzzes()).toHaveLength(before + 1), LONG);
  run.mockRestore();
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

test('a history read that fails shows "Sen couldn\'t read your history", and Retry reads it again without syncing', async () => {
  const read = jest.spyOn(txRepo, 'readPage').mockRejectedValue(new Error('disk'));
  const requests = jest.spyOn(bank, 'under');
  const run = jest.spyOn(syncService, 'sync');

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: "Sen couldn't read your history" }, LONG),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('history-skeleton')).not.toBeOnTheScreen();
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  const before = [requests.mock.calls.length, run.mock.calls.length];

  read.mockRestore();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  expect([requests.mock.calls.length, run.mock.calls.length]).toEqual(before);
  requests.mockRestore();
  run.mockRestore();
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
  ['timedOut', 'The check timed out. Amounts are still hidden. Try again.'],
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

test('a first sync that throws a bug shows a neutral error, not the storage advice, and Retry recovers', async () => {
  const run = jest
    .spyOn(syncService, 'sync')
    .mockRejectedValueOnce(new TypeError('x is undefined'));

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: 'Something went wrong' }, LONG),
  ).toBeOnTheScreen();
  expect(screen.getByText("Sen hit a problem it didn't expect. Try again.")).toBeOnTheScreen();
  expect(screen.queryByText(/Free some space/)).not.toBeOnTheScreen();
  expect(screen.queryByText('Reviewer settings')).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  run.mockRestore();
});

test('a bank that throws while a sync starts shows the neutral error instead of the skeleton', async () => {
  const under = jest.spyOn(bank, 'under').mockImplementationOnce(() => {
    throw new Error('scenario');
  });

  await renderHistory();

  expect(
    await screen.findByRole('header', { name: 'Something went wrong' }, LONG),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('history-skeleton')).not.toBeOnTheScreen();
  under.mockRestore();
});

test('a refresh that throws a bug over a list is a neutral banner', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  const run = jest
    .spyOn(syncService, 'sync')
    .mockRejectedValueOnce(new TypeError('x is undefined'));

  await fireEvent(screen.getByTestId('history-list'), 'refresh');

  expect(await screen.findByText("Sen couldn't refresh", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
  expect(screen.queryByText('Simulated · Change in Settings')).not.toBeOnTheScreen();
  run.mockRestore();
});

test('a first sync that throws instead of returning shows the storage error, and Retry recovers', async () => {
  const run = jest.spyOn(syncService, 'sync').mockRejectedValueOnce(DISK_FULL);

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
  const run = jest.spyOn(syncService, 'sync').mockRejectedValueOnce(DISK_FULL);

  await fireEvent(screen.getByTestId('history-list'), 'refresh');

  expect(
    await screen.findByText("Sen couldn't save to this phone", undefined, LONG),
  ).toBeOnTheScreen();
  expect(screen.getByText('Free some space, then try again.')).toBeOnTheScreen();
  expect(screen.queryByText('Simulated · Change in Settings')).not.toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  run.mockRestore();
});

const DISK_FULL = new Error('Error code 13: database or disk is full');

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
