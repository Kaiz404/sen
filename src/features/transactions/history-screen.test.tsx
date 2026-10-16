import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { readSyncState } from '@/services/sync';

import { bank, resetBank, syncProgress } from './data';
import { HistoryScreen } from './history-screen';

let mockDb: OpenDb;

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  showAmounts: async () => {
    jest.requireActual('@/services/prefs').writePref('hideAmounts', false);
    return { ok: true };
  },
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
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
    const fetchPage = jest.spyOn(bank, 'fetchPage');

    await renderHistory();

    expect(await screen.findByRole('header', { name: title }, { timeout })).toBeOnTheScreen();
    expect(fetchPage).toHaveBeenCalledTimes(calls);
    fetchPage.mockRestore();
  },
);

test('a simulated timeout keeps the skeleton for its 8 s deadline before the error shows', async () => {
  writePref('demo.next', 'timeout');
  const fetchPage = jest.spyOn(bank, 'fetchPage');
  await renderHistory();
  await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

  await act(() => jest.advanceTimersByTime(7500));
  expect(screen.queryByText('Taking too long')).not.toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(500));

  expect(await screen.findByText('Taking too long')).toBeOnTheScreen();
  fetchPage.mockRestore();
});

test('bad rows are counted and never retried, and the good rows show', async () => {
  writePref('demo.next', 'bad_data');
  const fetchPage = jest.spyOn(bank, 'fetchPage');

  await renderHistory();

  expect(await screen.findByText("2 items couldn't be read", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(fetchPage).toHaveBeenCalledTimes(1);
  fetchPage.mockRestore();
});

test('an offline fault covers one refresh: the banner shows, the fault turns itself off, and Retry recovers', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.next', 'offline');
  writePref('demo.newOnRefresh', true);

  await fireEvent(screen.getByTestId('history-list'), 'refresh');

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

  await fireEvent(screen.getByTestId('history-list'), 'refresh');
  writePref('demo.next', 'server');
  await act(() => jest.advanceTimersByTime(3000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  expect(screen.queryByText('Something broke on our side')).not.toBeOnTheScreen();
  expect(readPref('demo.next')).toBe('server');

  writePref('demo.slow', false);
  await fireEvent(screen.getByTestId('history-list'), 'refresh');

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
  expect(await readSyncState(mockDb)).toEqual({ cursor: 1000, syncedAt: expect.any(String) });
});

test('a failed first load fills the screen, with Retry and a way to the reviewer settings', async () => {
  writePref('demo.next', 'offline');
  await renderHistory();

  expect(await screen.findByText("Can't load your history", undefined, LONG)).toBeOnTheScreen();
  expect(screen.queryByTestId('history-list')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('link', { name: 'Reviewer settings' }));

  expect(mockPush).toHaveBeenCalledWith('/settings');
});
