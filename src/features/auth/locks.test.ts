import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import type { PrefKey, Prefs } from '@/models/prefs';
import type { OpenDb } from '@/services/db';
import { confirmDeviceCredential } from '@/services/device-credential';

import { startLockTriggers, TICK_MS, touch } from './locks';
import type { Session } from './machine';
import { sessionStore } from './session';
import { stepUp } from './use-step-up';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(async () => 0),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
}));
let mockPrefs: Partial<Prefs> = {};
jest.mock('@/services/prefs', () => {
  const { PREFS } = jest.requireActual('@/models/prefs');
  return { readPref: (key: PrefKey) => mockPrefs[key] ?? PREFS[key].default };
});
jest.mock('@/services/vault', () => ({}));
jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const mockCredential = jest.mocked(confirmDeviceCredential);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const MINUTE = 60_000;

let stop: () => void;

function start(session: Session) {
  sessionStore.setState({ session });
  stop = startLockTriggers();
}

function appGoes(state: AppStateStatus) {
  const listener = jest.mocked(AppState.addEventListener).mock.lastCall?.[1];
  listener?.(state);
}

const status = () => sessionStore.getState().session;

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  mockPrefs = {};
  sessionStore.setState(sessionStore.getInitialState());
});

afterEach(() => {
  stop();
  jest.useRealTimers();
});

test('returning after 59 s stays unlocked, after 61 s locks', () => {
  start({ status: 'unlocked', since: 0, db });

  appGoes('background');
  jest.advanceTimersByTime(59_000);
  appGoes('active');
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });

  appGoes('background');
  jest.advanceTimersByTime(61_000);
  appGoes('active');
  expect(status()).toEqual({ status: 'locked', reason: 'background' });
});

test('inactive alone never starts the re-lock window', () => {
  start({ status: 'unlocked', since: 0, db });

  appGoes('inactive');
  jest.advanceTimersByTime(2 * MINUTE);
  appGoes('active');

  expect(status()).toEqual({ status: 'unlocked', since: 0, db });
});

test('a long absence with the prompt still up on return, then a pass, stays unlocked: the pass is the user being here', async () => {
  start({ status: 'unlocked', since: 0, db });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const confirmed = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(2 * MINUTE);
  appGoes('active');
  expect(status().status).toBe('stepUp');
  answer({ success: true });

  expect(await confirmed).toEqual({ ok: true });
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });
});

test('re-locking right away never locks a step-up whose own prompt took Sen to the background', async () => {
  mockPrefs = { relockAfter: 0 };
  start({ status: 'unlocked', since: 0, db });
  sessionStore.setState({ biometric: { kind: 'face', level: 'passcode' } });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  mockCredential.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const confirmed = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(5_000);
  appGoes('active');
  answer({ success: true });

  expect(await confirmed).toEqual({ ok: true });
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });
});

test('a sensor lockout that hands over to the screen lock keeps the away time for the second prompt', async () => {
  mockPrefs = { relockAfter: 1 };
  start({ status: 'unlocked', since: 0, db });
  const api29 = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29);
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  mockCredential.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

  const confirmed = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(2 * MINUTE);
  appGoes('active');
  answer({ success: false, error: 'lockout' });

  await confirmed;
  api29.mockRestore();
  expect(status()).toEqual({ status: 'locked', reason: 'background' });
});

test('a short absence with the prompt still up on return does not lock', async () => {
  start({ status: 'unlocked', since: 0, db });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const confirmed = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(30_000);
  appGoes('active');
  answer({ success: true });

  expect(await confirmed).toEqual({ ok: true });
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });
});

test('a cancelled prompt after a long absence also locks', async () => {
  start({ status: 'unlocked', since: 0, db });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const cancelled = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(2 * MINUTE);
  appGoes('active');
  answer({ success: false, error: 'user_cancel' });

  await cancelled;
  expect(status()).toEqual({ status: 'locked', reason: 'background' });
});

test('Home on a step-up prompt cancels it, and a long time away still locks', async () => {
  start({ status: 'unlocked', since: 0, db });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const confirmed = stepUp('delete');
  appGoes('background');
  answer({ success: false, error: 'system_cancel' });
  expect(await confirmed).toEqual({ ok: false, reason: 'cancelled' });
  jest.advanceTimersByTime(2 * MINUTE);
  appGoes('active');

  expect(status()).toEqual({ status: 'locked', reason: 'background' });
});

test('five idle minutes lock, and a touch starts the count again', () => {
  start({ status: 'unlocked', since: 0, db });

  jest.advanceTimersByTime(4 * MINUTE);
  touch();
  jest.advanceTimersByTime(4 * MINUTE);
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });

  jest.advanceTimersByTime(MINUTE);
  expect(status()).toEqual({ status: 'locked', reason: 'idle' });
});

test('time in the background does not count as idle', () => {
  mockPrefs = { relockAfter: 5 };
  start({ status: 'unlocked', since: 0, db });

  appGoes('background');
  jest.advanceTimersByTime(4 * MINUTE);
  appGoes('active');
  jest.advanceTimersByTime(4 * MINUTE);
  expect(status()).toEqual({ status: 'unlocked', since: 0, db });

  jest.advanceTimersByTime(MINUTE);
  expect(status()).toEqual({ status: 'locked', reason: 'idle' });
});

test('a clock set back while away locks on return', () => {
  start({ status: 'unlocked', since: 0, db });

  jest.setSystemTime(10 * MINUTE);
  appGoes('background');
  jest.setSystemTime(5 * MINUTE);
  appGoes('active');

  expect(status()).toEqual({ status: 'locked', reason: 'background' });
});

test('a clock set back while in use counts as idle on the next tick', () => {
  start({ status: 'unlocked', since: 0, db });

  jest.advanceTimersByTime(4 * MINUTE);
  touch();
  jest.setSystemTime(MINUTE);
  jest.advanceTimersByTime(TICK_MS);

  expect(status()).toEqual({ status: 'locked', reason: 'idle' });
});

test('coming back to the app re-reads whether the fingerprint is on', async () => {
  jest
    .mocked(LocalAuthentication.getEnrolledLevelAsync)
    .mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
  start({ status: 'locked', reason: 'launch' });
  sessionStore.setState({ biometric: { kind: 'fingerprint', level: 'none' } });

  appGoes('active');
  await jest.advanceTimersByTimeAsync(0);

  expect(sessionStore.getState().biometric).toEqual({ kind: 'fingerprint', level: 'strong' });
});
