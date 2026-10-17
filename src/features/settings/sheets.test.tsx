import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { toast, ToastHost } from '@/components/toast';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import { readSyncState, sync } from '@/services/sync';
import { createMockBank } from '@/services/bank-api';

import { PrivacySheet, ResetDemoSheet, SignOutSheet } from './sheets';

let mockDb: OpenDb;
const mockRouter = { back: jest.fn(), dismissTo: jest.fn() };
const mockSignOut = jest.fn();

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  signOut: () => mockSignOut(),
}));

beforeEach(async () => {
  jest.useFakeTimers();
  clearPrefs();
  queryClient.clear();
  mockRouter.back.mockClear();
  mockRouter.dismissTo.mockClear();
  mockSignOut.mockReset();
  mockDb = await openTestDb();
});
afterEach(async () => {
  await act(async () => toast.hide());
  jest.useRealTimers();
});

const bankRows = async () =>
  (await mockDb.all("SELECT count(*) AS n FROM tx WHERE source = 'bank'"))[0]!.n;

test('reset demo data puts every reviewer control back, keeps security choices, and reloads from row zero', async () => {
  const size = { next: 'normal', size: 20, slow: false, newOnRefresh: false } as const;
  await sync(mockDb, createMockBank().under(size));
  writePref('demo.next', 'server');
  writePref('demo.datasetSize', 10000);
  writePref('demo.slow', true);
  writePref('demo.newOnRefresh', false);
  writePref('relockAfter', 0);
  await render(<ResetDemoSheet />);

  await fireEvent.press(screen.getByRole('button', { name: 'Reset demo data' }));
  await act(async () => {});

  expect([
    readPref('demo.next'),
    readPref('demo.datasetSize'),
    readPref('demo.slow'),
    readPref('demo.newOnRefresh'),
    readPref('relockAfter'),
  ]).toEqual(['normal', 1000, false, true, 0]);
  expect(await bankRows()).toBe(0);
  expect((await readSyncState(mockDb)).cursor).toBe(0);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
});

test('a reset that fails changes nothing, says so, stays open, and can be tried again', async () => {
  writePref('demo.next', 'server');
  writePref('demo.datasetSize', 10000);
  writePref('demo.slow', true);
  await render(<ResetDemoSheet />);
  await mockDb.close();

  await fireEvent.press(screen.getByRole('button', { name: 'Reset demo data' }));

  expect(
    await screen.findByText('Sen couldn’t reset the sample data. Nothing changed. Try again.'),
  ).toBeOnTheScreen();
  expect([readPref('demo.next'), readPref('demo.datasetSize'), readPref('demo.slow')]).toEqual([
    'server',
    10000,
    true,
  ]);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeEnabled();
});

test('sign out confirms through the session, and a failure says nothing was erased', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('keystore'));
  await render(
    <>
      <SignOutSheet />
      <ToastHost />
    </>,
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Nothing was erased. Try Start again.')).toBeOnTheScreen();
});

test('the privacy sheet names the phone’s biometric and closes on Got it', async () => {
  await render(<PrivacySheet />);

  expect(
    screen.getByText('Showing amounts asks for fingerprint every time. Hiding them never asks.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));

  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
