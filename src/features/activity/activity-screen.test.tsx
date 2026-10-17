import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { StepUpResult } from '@/features/auth';
import { activity, readActivity } from '@/services/activity-log';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';

import { ActivityScreen } from './activity-screen';

let mockDb: OpenDb;
let queryClient: QueryClient;
let mockStepUp: () => Promise<StepUpResult>;
const mockBack = jest.fn();

jest.mock('@/services/logger');
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  useStepUp: () => () => mockStepUp(),
}));

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date('2026-10-15T08:00:00.000Z'),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'nextTick',
      'queueMicrotask',
    ],
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  mockBack.mockClear();
  mockStepUp = async () => ({ ok: true });
  mockDb = await openTestDb();
});
afterEach(async () => {
  jest.useRealTimers();
  await mockDb.close();
});

const loaded = () => waitFor(() => expect(screen.queryByTestId('activity-loading')).toBeNull());

const open = async () => {
  await render(
    <QueryClientProvider client={queryClient}>
      <ActivityScreen />
    </QueryClientProvider>,
  );
  await loaded();
};

async function seed() {
  activity.record(mockDb, { code: 'auth.unlocked' });
  jest.setSystemTime(Date.now() + 1000);
  activity.record(mockDb, { code: 'tx.added', label: 'Lunch with Hafiz, cash' });
  jest.setSystemTime(Date.now() + 1000);
  activity.record(mockDb, { code: 'auth.failed', reason: 'mismatch' });
  await activity.settled();
}

test('the log clears the status bar at the top and the gesture bar at the end', async () => {
  await open();
  expect(StyleSheet.flatten(screen.getByTestId('activity').props.contentContainerStyle)).toMatchObject({
    paddingTop: 48 + 16,
    paddingBottom: 34 + 24,
  });
});

test('the log reads as day slips with the words, the description and the time, and no amount', async () => {
  await seed();
  await open();

  expect(screen.getByText('TODAY · THU 15 OCT · 3 EVENTS')).toBeOnTheScreen();
  expect(screen.getByText('Unlocked with fingerprint')).toBeOnTheScreen();
  expect(screen.getByText('Fingerprint didn’t match')).toBeOnTheScreen();
  expect(screen.getByText('Added a transaction')).toBeOnTheScreen();
  expect(screen.getByText('“Lunch with Hafiz, cash”')).toBeOnTheScreen();
  expect(screen.getAllByText('4:00 pm')).toHaveLength(3);
  expect(screen.getByText('START OF LOG · 3 OF 50 KEPT')).toBeOnTheScreen();
  expect(screen.queryByText(/RM/)).toBeNull();
});

test('an empty log says so and offers no Clear log', async () => {
  await open();

  expect(screen.getByText('Nothing yet')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Clear log' })).toBeNull();
});

test('Clear log asks for the check, empties the log and leaves the one entry that says so', async () => {
  await seed();
  await open();

  await fireEvent.press(screen.getByRole('button', { name: 'Clear log' }));
  expect(await screen.findByText('Log cleared')).toBeOnTheScreen();

  expect((await readActivity(mockDb)).entries.map((e) => e.event.code)).toEqual(['log.cleared']);
  expect(screen.queryByText('Added a transaction')).toBeNull();
});

test('a check that is not available keeps the log and says so', async () => {
  await seed();
  mockStepUp = async () => ({ ok: false, reason: 'unavailable' });
  await open();

  await fireEvent.press(screen.getByRole('button', { name: 'Clear log' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The check isn’t available right now. The log is as it was.',
  );
  expect((await readActivity(mockDb)).entries).toHaveLength(3);
});

test('a check that times out keeps the log and says so', async () => {
  await seed();
  mockStepUp = async () => ({ ok: false, reason: 'timedOut' });
  await open();

  await fireEvent.press(screen.getByRole('button', { name: 'Clear log' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The check timed out. The log is as it was.',
  );
  expect((await readActivity(mockDb)).entries).toHaveLength(3);
});

test('a cancelled check leaves the log and says nothing', async () => {
  await seed();
  mockStepUp = async () => ({ ok: false, reason: 'cancelled' });
  await open();

  await fireEvent.press(screen.getByRole('button', { name: 'Clear log' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Clear log' })).toBeEnabled());

  expect(screen.queryByRole('alert')).toBeNull();
  expect((await readActivity(mockDb)).entries).toHaveLength(3);
});

test('a log that cannot be read offers Try again, and Try again recovers', async () => {
  await seed();
  const all = jest.spyOn(mockDb, 'all').mockRejectedValueOnce(new Error('disk'));
  await open();
  expect(screen.getByText('Sen can’t read the log')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('Unlocked with fingerprint')).toBeOnTheScreen();
  all.mockRestore();
});

test('the back key returns to settings', async () => {
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to settings' }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});
