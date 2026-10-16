import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, type AppStateStatus } from 'react-native';

import type { PrefKey, Prefs } from '@/models/prefs';
import type { OpenDb } from '@/services/db';

import { startLockTriggers, touch } from './locks';
import type { Session } from './machine';
import { sessionStore } from './session';
import { stepUp } from './use-step-up';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
let mockPrefs: Partial<Prefs> = {};
jest.mock('@/services/prefs', () => {
  const { PREFS } = jest.requireActual('@/models/prefs');
  return { readPref: (key: PrefKey) => mockPrefs[key] ?? PREFS[key].default };
});
jest.mock('@/services/vault', () => ({}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
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

test('leaving the app while a prompt is up does not lock', async () => {
  start({ status: 'unlocked', since: 0, db });
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

  const confirmed = stepUp('delete');
  appGoes('background');
  jest.advanceTimersByTime(2 * MINUTE);
  answer({ success: true });
  expect(await confirmed).toEqual({ ok: true });
  appGoes('active');

  expect(status()).toEqual({ status: 'unlocked', since: 0, db });
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
