import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { toast, ToastHost } from '@/components/toast';
import type { StepUpResult } from '@/features/auth';
import { DayKeySchema, InstantSchema } from '@/models/day';
import { draftSchema } from '@/models/draft';
import { createMockBank } from '@/services/bank-api';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { sync } from '@/services/sync';
import { getTransaction, insertManual } from '@/services/tx-repo';

import { DeleteSheet } from './delete-sheet';

let mockDb: OpenDb;
let mockId = '';
const mockStepUp = jest.fn<Promise<StepUpResult>, []>();
const mockRouter = { back: jest.fn(), dismissTo: jest.fn() };

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useStepUp: () => mockStepUp,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');
const TODAY = DayKeySchema.parse('2026-10-15');
const KEY = '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const ADDED = `m-${KEY}`;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  clearPrefs();
  mockStepUp.mockReset();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  queryClient.clear();
  mockDb = await openTestDb();
  const now = InstantSchema.parse(NOW.toISOString());
  const scenario = { next: 'normal', size: 20, slow: false, newOnRefresh: false } as const;
  await sync(mockDb, createMockBank({ now: () => now }).under(scenario), {
    now: () => now,
  });
  const draft = draftSchema(TODAY).parse({
    idemKey: KEY,
    amountMinor: 4250,
    direction: 'debit',
    description: 'Lunch with Hafiz, cash',
    category: 'food',
    day: TODAY,
  });
  await insertManual(mockDb, draft, now);
});
afterEach(async () => {
  await act(async () => toast.hide());
  await mockDb.close();
  jest.useRealTimers();
});

async function renderSheet(id: string) {
  mockId = id;
  await render(
    <QueryClientProvider client={queryClient}>
      <DeleteSheet />
      <ToastHost />
    </QueryClientProvider>,
  );
}

const added = () => getTransaction(mockDb, ADDED as Parameters<typeof getTransaction>[1]);

test('delete with step-up removes the row, and Undo puts the same row back without a prompt', async () => {
  mockStepUp.mockResolvedValueOnce({ ok: true });
  const before = await added();
  await renderSheet(ADDED);

  expect(await screen.findByRole('header', { name: 'Delete this transaction?' })).toBeOnTheScreen();
  expect(
    screen.getByText(
      "It's removed from this phone and from your October totals. Bank rows aren't touched. You can undo for 6 seconds.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText('Amount hidden')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Delete with fingerprint' }));

  expect(mockStepUp).toHaveBeenCalledTimes(1);
  expect(await added()).toBeNull();
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  expect(screen.getByText('Lunch with Hafiz, cash · gone from this phone')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo delete' }));
  expect(await added()).toEqual(before);
  expect(mockStepUp).toHaveBeenCalledTimes(1);
});

test('a cancelled prompt keeps the row and the sheet, silently', async () => {
  mockStepUp.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
  await renderSheet(ADDED);
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete with fingerprint' }));

  expect(await added()).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Delete with fingerprint' })).toBeEnabled();
  expect(screen.queryByText(/Nothing was deleted/)).toBeNull();
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});

test('a finger that does not match says nothing was deleted and offers another try', async () => {
  mockStepUp.mockResolvedValueOnce({ ok: false, reason: 'mismatch' });
  await renderSheet(ADDED);
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete with fingerprint' }));

  expect(screen.getByText("Fingerprint didn't match. Nothing was deleted.")).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Try again with fingerprint' })).toBeEnabled();
  expect(await added()).not.toBeNull();
});

test('a bank row is read only: no delete key and no prompt', async () => {
  await renderSheet('bk-20');

  expect(
    await screen.findByRole('header', { name: 'From your bank · read only' }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Delete with fingerprint' })).toBeNull();
  expect(mockStepUp).not.toHaveBeenCalled();
});

test('a row that is gone says so', async () => {
  await renderSheet('m-gone');
  expect(
    await screen.findByRole('header', { name: "This transaction isn't here any more." }),
  ).toBeOnTheScreen();
});

test.each([['an id over 64 characters', 'm-'.padEnd(65, 'x')], ['an empty id', '']])(
  'a link with %s says the row is gone instead of throwing',
  async (_case, id) => {
    await renderSheet(id);
    expect(
      await screen.findByRole('header', { name: "This transaction isn't here any more." }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Delete with/ })).toBeNull();
  },
);
