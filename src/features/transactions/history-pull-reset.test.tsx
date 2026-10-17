import '@shopify/flash-list/jestSetup';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { openTestDb } from '@/services/db/testing/node-adapter';
import type { OpenDb } from '@/services/db';
import { InstantSchema } from '@/models/day';
import { clearPrefs, readBankState, writeBankState, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { arrivals, resetBank, syncProgress } from './data';
import { HistoryScreen } from './history-screen';
import { pullDown } from './pull/testing';

let mockDb: OpenDb;
jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useIsFocused: () => true }));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
}));
const NOW = new Date('2026-10-15T06:00:00.000Z');
beforeEach(async () => {
  arrivals.setState({ after: null, added: null });
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
  writePref('demo.datasetSize', 20);
  writePref('demo.newOnRefresh', true);
  queryClient.clear();
  mockDb = await openTestDb();
});
afterEach(() => jest.useRealTimers());

test('a bank reset while a slow pull runs does not leave the gap loading', async () => {
  await render(<QueryClientProvider client={queryClient}><HistoryScreen /></QueryClientProvider>);
  expect(await screen.findByText('Tealive', undefined, { timeout: 4000 })).toBeOnTheScreen();
  writePref('demo.slow', true);
  await act(() => pullDown());
  expect(screen.getByText('CHECKING WITH YOUR BANK')).toBeOnTheScreen();
  writePref('demo.slow', false);
  await act(() => resetBank(mockDb));
  for (let i = 0; i < 20; i++) await act(() => jest.advanceTimersByTime(1000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  for (let i = 0; i < 5; i++) await act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('Tealive')).toBeOnTheScreen();
  expect(screen.queryByText('CHECKING WITH YOUR BANK')).not.toBeOnTheScreen();
});

test('control: the same slow pull without a reset lands and closes', async () => {
  await render(<QueryClientProvider client={queryClient}><HistoryScreen /></QueryClientProvider>);
  expect(await screen.findByText('Tealive', undefined, { timeout: 4000 })).toBeOnTheScreen();
  writePref('demo.slow', true);
  await act(() => pullDown());
  expect(screen.getByText('CHECKING WITH YOUR BANK')).toBeOnTheScreen();
  writePref('demo.slow', false);
  for (let i = 0; i < 20; i++) await act(() => jest.advanceTimersByTime(1000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  for (let i = 0; i < 5; i++) await act(() => jest.advanceTimersByTime(2000));
  expect(screen.queryByText('CHECKING WITH YOUR BANK')).not.toBeOnTheScreen();
});

test('after the reset, a fresh pull asks the bank', async () => {
  const { bank } = jest.requireActual('./data');
  await render(<QueryClientProvider client={queryClient}><HistoryScreen /></QueryClientProvider>);
  expect(await screen.findByText('Tealive', undefined, { timeout: 4000 })).toBeOnTheScreen();
  writePref('demo.slow', true);
  await act(() => pullDown());
  writePref('demo.slow', false);
  await act(() => resetBank(mockDb));
  for (let i = 0; i < 25; i++) await act(() => jest.advanceTimersByTime(1000));
  await waitFor(() => expect(syncProgress.getState().progress).toBeNull());
  const requests = jest.spyOn(bank, 'under');
  await act(() => pullDown());
  for (let i = 0; i < 5; i++) await act(() => jest.advanceTimersByTime(1000));
  expect(requests).toHaveBeenCalledTimes(1);
});

test('a bank reset clears what the mock bank remembers, so the next feed starts fresh', async () => {
  const at = InstantSchema.parse('2026-10-15T06:00:00.000Z');
  const kept = { anchor: at, minted: { '20': [{ seq: 21, postedAt: at }] } };
  writeBankState(kept);
  expect(readBankState()).toEqual(kept);

  await act(() => resetBank(mockDb));

  expect(readBankState()).toEqual({ anchor: null, minted: {} });
});
