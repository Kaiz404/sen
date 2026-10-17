import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { activity, readActivity } from '@/services/activity-log';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { confirmDeviceCredential } from '@/services/device-credential';
import { clearPrefs } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import * as Vault from '@/services/vault';

import { hideAmounts, showAmounts } from './amounts';
import { CREDENTIAL_TIMEOUT_MS } from './prompt';
import { dispatch, lockNow, sessionStore, signOut, unlock } from './session';
import { stepUp } from './use-step-up';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
}));
jest.mock('@/services/logger');
jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
}));
jest.mock('@/services/vault', () => ({
  hasVault: jest.fn(),
  openVault: jest.fn(),
  destroyVault: jest.fn(),
}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const openVault = jest.mocked(Vault.openVault);

let db: OpenDb;

/** Android 9 and 10 ask the sensor alone and hand a lockout over to the screen lock. */
const onApi29 = () => jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29);

const codes = async () => {
  await activity.settled();
  return (await readActivity(db)).entries.map((e) => e.event).reverse();
};

async function unlockWith(success: boolean) {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce(
    success ? { success: true } : { success: false, error: 'authentication_failed' },
  );
  openVault.mockResolvedValueOnce({ kind: 'opened', db });
  return unlock();
}

beforeEach(async () => {
  jest.clearAllMocks();
  authenticate.mockReset();
  openVault.mockReset();
  activity.discard();
  clearPrefs();
  queryClient.clear();
  sessionStore.setState(sessionStore.getInitialState());
  db = await openTestDb();
});
afterEach(() => {
  jest.restoreAllMocks();
  return db.close();
});

test('a sensor lockout is held until the vault opens, then written before the unlock', async () => {
  onApi29();
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'lockout' });
  jest.mocked(confirmDeviceCredential).mockResolvedValueOnce({ success: true });
  openVault.mockResolvedValueOnce({ kind: 'opened', db });

  expect(await unlock()).toEqual({ ok: true });

  expect(await codes()).toEqual([
    { code: 'auth.failed', reason: 'lockout' },
    { code: 'auth.unlocked' },
  ]);
});

test('a cancelled prompt is not a security event', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  await unlock();
  await unlockWith(true);

  expect(await codes()).toEqual([{ code: 'auth.unlocked' }]);
});

test('locking logs why, and the write is queued ahead of the database closing', async () => {
  await unlockWith(true);
  dispatch({ type: 'ARRIVED' });
  await activity.settled();
  const run = jest.spyOn(db, 'run');
  const close = jest.spyOn(db, 'close');

  lockNow();

  const insert = run.mock.calls.findIndex(([sql]) => sql.startsWith('INSERT INTO activity_log'));
  expect(run.mock.calls[insert]?.[1]).toEqual([
    expect.any(String),
    expect.any(String),
    'lock.locked',
    '{"reason":"manual"}',
  ]);
  expect(run.mock.invocationCallOrder[insert]).toBeLessThan(close.mock.invocationCallOrder[0]!);
  await activity.settled();
  await expect(run.mock.results[insert]?.value).resolves.toEqual({ changes: 1 });
});

test('showing needs the check and is logged, hiding is logged only when amounts were showing', async () => {
  await unlockWith(true);
  dispatch({ type: 'ARRIVED' });
  authenticate.mockResolvedValueOnce({ success: true });
  await showAmounts();
  hideAmounts();
  hideAmounts();

  expect((await codes()).map((e) => e.code)).toEqual([
    'auth.unlocked',
    'amounts.revealed',
    'amounts.hidden',
  ]);
  expect(sessionStore.getState().amountsHidden).toBe(true);
});

test('a prompt that times out is logged as nothing, on Lock and on a step-up', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockReturnValueOnce(new Promise(() => undefined));
  const locked = unlock();
  await jest.advanceTimersByTimeAsync(CREDENTIAL_TIMEOUT_MS);
  expect(await locked).toEqual({ ok: false, reason: 'timedOut' });

  await unlockWith(true);
  dispatch({ type: 'ARRIVED' });
  authenticate.mockReturnValueOnce(new Promise(() => undefined));
  const stepping = stepUp('add');
  await jest.advanceTimersByTimeAsync(CREDENTIAL_TIMEOUT_MS);
  expect(await stepping).toEqual({ ok: false, reason: 'timedOut' });
  jest.useRealTimers();

  expect((await codes()).map((e) => e.code)).toEqual(['auth.unlocked']);
});

test('a step-up whose sensor locks out is logged, a cancelled one is not', async () => {
  onApi29();
  await unlockWith(true);
  dispatch({ type: 'ARRIVED' });
  authenticate.mockResolvedValueOnce({ success: false, error: 'lockout' });
  jest.mocked(confirmDeviceCredential).mockResolvedValueOnce({ success: true });
  await stepUp('add');
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  await stepUp('add');

  expect((await codes()).map((e) => e.code)).toEqual(['auth.unlocked', 'auth.failed']);
});

test('a lock during a step-up is logged once when the prompt ends, and the answer it ended on is not', async () => {
  await unlockWith(true);
  dispatch({ type: 'ARRIVED' });
  await activity.settled();
  jest.spyOn(db, 'close').mockResolvedValueOnce();
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const asked = stepUp('add');
  dispatch({ type: 'LOCK', reason: 'background' });
  lockNow();
  answer({ success: false, error: 'user_cancel' });

  expect(await asked).toEqual({ ok: false, reason: 'cancelled' });
  expect(sessionStore.getState().session).toEqual({ status: 'locked', reason: 'background' });
  await unlockWith(true);
  expect(await codes()).toEqual([
    { code: 'auth.unlocked' },
    { code: 'lock.locked', reason: 'background' },
    { code: 'auth.unlocked' },
  ]);
});

test('signing out drops held events, so the next user starts with an empty log', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'lockout' });
  jest.mocked(confirmDeviceCredential).mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  onApi29();
  await unlock();
  jest.mocked(Vault.destroyVault).mockResolvedValueOnce();
  await signOut();

  await unlockWith(true);
  expect(await codes()).toEqual([{ code: 'auth.unlocked' }]);
});
