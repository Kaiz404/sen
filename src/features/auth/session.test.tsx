import { act, render, renderHook, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { toast, ToastHost } from '@/components/toast';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { queryClient } from '@/services/query-client';
import * as Vault from '@/services/vault';

import {
  armLockout,
  dismissDbResetNotice,
  launch,
  lockNow,
  sessionStore,
  signOut,
  unlock,
  useDb,
  useDbResetNotice,
} from './session';
import { gateOf } from './machine';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
}));
jest.mock('@/services/vault', () => ({
  hasVault: jest.fn(),
  openVault: jest.fn(),
  destroyVault: jest.fn(),
}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const hasVault = jest.mocked(Vault.hasVault);
const openVault = jest.mocked(Vault.openVault);
const destroyVault = jest.mocked(Vault.destroyVault);

const session = () => sessionStore.getState().session;
const closed = (db: OpenDb) =>
  db.all('SELECT 1').then(
    () => 'open',
    (error: Error) => error.message,
  );

async function unlockInto(db: OpenDb) {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: true });
  openVault.mockResolvedValueOnce({ kind: 'opened', db });
  return unlock();
}

beforeEach(() => {
  jest.clearAllMocks();
  [authenticate, hasVault, openVault, destroyVault].forEach((mock) => mock.mockReset());
  queryClient.clear();
  sessionStore.setState(sessionStore.getInitialState());
});

test.each([
  ['no vault', () => hasVault.mockResolvedValueOnce(false), { status: 'welcome' }],
  ['a vault', () => hasVault.mockResolvedValueOnce(true), { status: 'locked', reason: 'launch' }],
  [
    'a failed vault check',
    () => hasVault.mockRejectedValueOnce(new Error('keystore')),
    { status: 'locked', reason: 'launch' },
  ],
])('launch with %s', async (_, arrange, expected) => {
  arrange();

  await launch();

  expect(session()).toEqual(expected);
});

test('unlock opens the vault and hands its database to protected screens', async () => {
  const db = await openTestDb();

  expect(await unlockInto(db)).toEqual({ ok: true });

  expect(session()).toMatchObject({ status: 'unlocked', db });
  expect((await renderHook(() => useDb())).result.current).toBe(db);
});

test('an unlock with a hold keeps Lock routed for that long, then opens History', async () => {
  jest.useFakeTimers();
  const db = await openTestDb();
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: true });
  openVault.mockResolvedValueOnce({ kind: 'opened', db });

  expect(await unlock(1370)).toEqual({ ok: true });
  expect(session()).toMatchObject({ status: 'arriving', purpose: 'unlock', db });
  expect(gateOf(session())).toBe('locked');
  jest.advanceTimersByTime(1369);
  expect(session().status).toBe('arriving');
  jest.advanceTimersByTime(1);

  expect(session()).toMatchObject({ status: 'unlocked', db });
  jest.useRealTimers();
});

test('a lock while Sen plays the unlock closes the vault, and the hold ending changes nothing', async () => {
  jest.useFakeTimers();
  const db = await openTestDb();
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: true });
  openVault.mockResolvedValueOnce({ kind: 'opened', db });
  await unlock(1370);

  lockNow();
  jest.advanceTimersByTime(1370);

  expect(session()).toEqual({ status: 'locked', reason: 'manual' });
  expect(await closed(db)).toBe('The database is closed.');
  jest.useRealTimers();
});

test('a cancelled unlock stays on Lock and leaves the vault shut', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'idle' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

  expect(await unlock()).toEqual({ ok: false, reason: 'cancelled' });

  expect(session()).toEqual({ status: 'locked', reason: 'idle' });
  expect(openVault).not.toHaveBeenCalled();
});

test('a second unlock while the prompt is up opens no second prompt', async () => {
  const db = await openTestDb();
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  openVault.mockResolvedValueOnce({ kind: 'opened', db });

  const first = unlock();
  const second = await unlock();
  answer({ success: true });

  expect(second).toEqual({ ok: false, reason: 'cancelled' });
  expect(await first).toEqual({ ok: true });
  expect(authenticate).toHaveBeenCalledTimes(1);
  expect(session()).toMatchObject({ status: 'unlocked', db });
});

test('a vault that fails to open stays on Lock', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: true });
  openVault.mockRejectedValueOnce(new Error('disk'));

  expect(await unlock()).toEqual({ ok: false, reason: 'unknown' });
  expect(session()).toEqual({ status: 'locked', reason: 'launch' });
});

test('lock clears the query cache and closes the database', async () => {
  const db = await openTestDb();
  await unlockInto(db);
  queryClient.setQueryData(['tx', 'page', 0], ['Tealive']);

  lockNow();

  expect(session()).toEqual({ status: 'locked', reason: 'manual' });
  expect(queryClient.getQueryData(['tx', 'page', 0])).toBeUndefined();
  expect(await closed(db)).toBe('The database is closed.');
});

test('a lock hides the toast, which can carry transaction text', async () => {
  const db = await openTestDb();
  await unlockInto(db);
  await render(<ToastHost />);
  await act(async () => {
    toast.show({ title: 'Deleted', detail: 'Lunch with Hafiz, cash' });
  });
  expect(screen.getByText('Lunch with Hafiz, cash')).toBeOnTheScreen();

  await act(async () => lockNow());

  expect(screen.queryByText('Lunch with Hafiz, cash')).not.toBeOnTheScreen();
});

test('a reset vault leaves one notice for History', async () => {
  const db = await openTestDb();
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: true });
  openVault.mockResolvedValueOnce({ kind: 'reset', db, reason: 'missing_key' });
  await unlock();
  const notice = await renderHook(() => useDbResetNotice());

  expect(notice.result.current).toBe('missing_key');

  await act(() => dismissDbResetNotice());
  expect(notice.result.current).toBeNull();
});

test('sign out closes the database before the vault is destroyed, then shows Welcome', async () => {
  const db = await openTestDb();
  await unlockInto(db);
  let atDestroy = '';
  destroyVault.mockImplementationOnce(async () => {
    atDestroy = await closed(db);
  });

  await signOut();

  expect(atDestroy).toBe('The database is closed.');
  expect(destroyVault).toHaveBeenCalledTimes(1);
  expect(session()).toEqual({ status: 'welcome' });
});

test('an unlock during sign-out opens no prompt, and sign-out ends on Welcome', async () => {
  const db = await openTestDb();
  sessionStore.setState({ session: { status: 'locked', reason: 'idle' } });
  let finish: () => void = () => {};
  destroyVault.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
  authenticate.mockResolvedValue({ success: true });
  openVault.mockResolvedValue({ kind: 'created', db });

  const signingOut = signOut();
  expect(await unlock()).toEqual({ ok: false, reason: 'cancelled' });
  finish();
  await signingOut;

  expect(authenticate).not.toHaveBeenCalled();
  expect(session()).toEqual({ status: 'welcome' });
});

test('a sign-out that fails returns to Lock and keeps nothing open', async () => {
  const db = await openTestDb();
  await unlockInto(db);
  destroyVault.mockRejectedValueOnce(new Error('keystore'));

  await expect(signOut()).rejects.toThrow('keystore');

  expect(session()).toEqual({ status: 'locked', reason: 'signout' });
  expect(await closed(db)).toBe('The database is closed.');
});

test('an armed lockout reports lockout once without prompting', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  armLockout();

  expect(await unlock()).toEqual({ ok: false, reason: 'lockout' });
  expect(authenticate).not.toHaveBeenCalled();
  expect(await unlock()).toEqual({ ok: false, reason: 'cancelled' });
});
