import '@shopify/flash-list/jestSetup';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryScreen } from '@/features/transactions';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { readSyncState } from '@/services/sync';

import { SettingsScreen } from './settings-screen';

let mockDb: OpenDb;

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');
const LONG = { timeout: 4000 };

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
  writePref('demo.datasetSize', 20);
  queryClient.clear();
  mockDb = await openTestDb();
});
afterEach(() => jest.useRealTimers());

/** History with Settings open over it, as the stack holds them. */
async function renderBoth() {
  await render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
      <SettingsScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
}

const pick = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));
const pull = () => fireEvent(screen.getByTestId('history-list'), 'refresh');
const reads = (name: string) =>
  screen.getByRole('radio', { name }).props.accessibilityState.checked as boolean;
const SIMULATED = { name: 'Simulated fault. Change it in Settings' };

test.each([
  ['Offline', "You're offline", 0],
  ['Timeout (8 s)', 'Taking too long', 8000],
  ['Server error 500', 'Something broke on our side', 0],
] as const)(
  '%s: a pull shows the simulated "%s" banner, the control reads Normal again, and Retry recovers',
  async (control, banner, waitMs) => {
    await renderBoth();
    await pick(control);

    await pull();
    await act(() => jest.advanceTimersByTime(waitMs));

    expect(await screen.findByText(banner, undefined, LONG)).toBeOnTheScreen();
    expect(screen.getByRole('link', SIMULATED)).toBeOnTheScreen();
    expect(screen.getByText('Tealive')).toBeOnTheScreen();
    expect(reads('Normal')).toBe(true);

    await act(() => jest.advanceTimersByTime(60_000));
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
    expect(screen.queryByText(banner)).not.toBeOnTheScreen();
  },
);

test('Bad data: a pull keeps the good rows and counts two bad ones, and the next pull is clean', async () => {
  await renderBoth();
  await pick('Bad data');

  await pull();

  expect(await screen.findByText("2 items couldn't be read", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(reads('Normal')).toBe(true);

  await pull();

  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
  expect(screen.queryByText("2 items couldn't be read")).not.toBeOnTheScreen();
});

test('Slow network holds a pull for 3 s, and turning it off lands the next pull at once', async () => {
  await renderBoth();
  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));

  await pull();
  await act(() => jest.advanceTimersByTime(2900));
  expect(screen.queryByText('1 new', { exact: false })).not.toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(100));
  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);

  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));
  await act(() => jest.advanceTimersByTime(60_000));
  await pull();

  expect(await screen.findAllByText('1 new', { exact: false }, { timeout: 500 })).not.toHaveLength(
    0,
  );
});

test('a fault turned back to Normal before the next request never fires', async () => {
  await renderBoth();
  await pick('Offline');
  await pick('Normal');

  await pull();

  expect(await screen.findAllByText('1 new', { exact: false }, LONG)).not.toHaveLength(0);
  expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
});

test('Offline before a dataset switch fails the first load full screen, and Retry loads the new size', async () => {
  await renderBoth();
  await pick('Offline');

  await fireEvent.press(screen.getByRole('radio', { name: '1k' }));

  expect(await screen.findByText("Can't load your history", undefined, LONG)).toBeOnTheScreen();
  expect(screen.getByText('NO CONNECTION · SIMULATED')).toBeOnTheScreen();
  expect(reads('Normal')).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('Tealive', undefined, LONG)).toBeOnTheScreen();
  expect((await readSyncState(mockDb)).cursor).toBe(1000);
});

test('a dataset switch shows its progress line until the new rows are in', async () => {
  await renderBoth();
  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));

  await fireEvent.press(screen.getByRole('radio', { name: '1k' }));

  expect(await screen.findByText('Loading 0 of 1,000 rows…', undefined, LONG)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(3000));
  expect(await screen.findByText('Loading 500 of 1,000 rows…', undefined, LONG)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(3000));

  expect(
    await screen.findByText('Reloads the bank rows. Rows you added stay.', undefined, LONG),
  ).toBeOnTheScreen();
  expect((await readSyncState(mockDb)).cursor).toBe(1000);
});

test('a fault picked while a two-page load runs leaves that load whole, and the next pull takes it', async () => {
  await renderBoth();
  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));
  await fireEvent.press(screen.getByRole('radio', { name: '1k' }));
  expect(await screen.findByText('Loading 0 of 1,000 rows…', undefined, LONG)).toBeOnTheScreen();

  await pick('Server error 500');
  await act(() => jest.advanceTimersByTime(3000));
  expect(await screen.findByText('Loading 500 of 1,000 rows…', undefined, LONG)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(3000));

  expect(
    await screen.findByText('Reloads the bank rows. Rows you added stay.', undefined, LONG),
  ).toBeOnTheScreen();
  expect((await readSyncState(mockDb)).cursor).toBe(1000);
  expect(screen.queryByText('Something broke on our side')).not.toBeOnTheScreen();
  expect(reads('Server error 500')).toBe(true);

  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));
  await pull();

  expect(await screen.findByText('Something broke on our side', undefined, LONG)).toBeOnTheScreen();
  expect(reads('Normal')).toBe(true);
});
