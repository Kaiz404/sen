import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';

import { bank } from './data';
import { HistoryScreen } from './history-screen';

let mockDb: OpenDb;

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
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
  ['offline', 2, "Can't load your history"],
  ['timeout', 2, 'Taking too long'],
  ['server', 2, 'Something broke on our side'],
] as const)(
  'a first sync that fails %s is tried %i times, then shows "%s"',
  async (next, calls, title) => {
    writePref('demo.next', next);
    const fetchPage = jest.spyOn(bank, 'fetchPage');

    await renderHistory();

    expect(await screen.findByRole('header', { name: title }, LONG)).toBeOnTheScreen();
    expect(fetchPage).toHaveBeenCalledTimes(calls);
    fetchPage.mockRestore();
  },
);

test('bad rows are counted and never retried, and the good rows show', async () => {
  writePref('demo.next', 'bad_data');
  const fetchPage = jest.spyOn(bank, 'fetchPage');

  await renderHistory();

  expect(await screen.findByText("2 items couldn't be read", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(fetchPage).toHaveBeenCalledTimes(1);
  fetchPage.mockRestore();
});

test('a failed refresh keeps the list under an offline banner, and Retry brings a new row', async () => {
  await renderHistory();
  expect(await screen.findByText('Tealive')).toBeOnTheScreen();
  writePref('demo.next', 'offline');

  await fireEvent(screen.getByTestId('history-list'), 'refresh');

  expect(await screen.findByText("You're offline", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Showing history from 2:00 pm.')).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();

  writePref('demo.next', 'normal');
  writePref('demo.newOnRefresh', true);
  await act(() => jest.advanceTimersByTime(60_000));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
});
