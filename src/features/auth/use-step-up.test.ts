import { renderHook } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import type { OpenDb } from '@/services/db';
import { confirmDeviceCredential } from '@/services/device-credential';

import type { Session } from './machine';
import { sessionStore } from './session';
import { useStepUp } from './use-step-up';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
}));
jest.mock('@/services/vault', () => ({}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const unlocked: Session = { status: 'unlocked', since: 0, db };

const stepUpFor = async (action: Parameters<typeof useStepUp>[0]) =>
  (await renderHook(() => useStepUp(action))).result.current;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStore.setState({ session: unlocked });
});

test('every call prompts again with the sensor alone and no device fallback', async () => {
  authenticate.mockResolvedValue({ success: true });
  const confirmDelete = await stepUpFor('delete');

  expect(await confirmDelete()).toEqual({ ok: true });
  expect(await confirmDelete()).toEqual({ ok: true });

  const options = { promptMessage: 'Delete this transaction',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  };
  expect(authenticate.mock.calls).toEqual([[options], [options]]);
  expect(sessionStore.getState().session).toBe(unlocked);
});

test('a second step-up while one is prompting opens no second prompt', async () => {
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  const confirmAdd = await stepUpFor('add');

  const first = confirmAdd();
  const second = await confirmAdd();
  answer({ success: true });

  expect(second).toEqual({ ok: false, reason: 'cancelled' });
  expect(await first).toEqual({ ok: true });
  expect(authenticate).toHaveBeenCalledTimes(1);
  expect(sessionStore.getState().session).toBe(unlocked);
});

test.each([
  ['user_cancel', 'cancelled'],
  ['system_cancel', 'cancelled'],
  ['app_cancel', 'cancelled'],
  ['user_fallback', 'cancelled'],
  ['authentication_failed', 'unknown'],
  ['not_enrolled', 'unavailable'],
  ['passcode_not_set', 'noLock'],
  ['not_available', 'unavailable'],
  ['timeout', 'unknown'],
  ['unknown', 'unknown'],
] as const)('%s fails the step-up as %s', async (error, reason) => {
  // The combined sheet is the one ask, so the screen lock is never reached by these codes.
  authenticate.mockResolvedValue({ success: false, error });

  expect(await (await stepUpFor('erase'))()).toEqual({ ok: false, reason });
  expect(confirmDeviceCredential).not.toHaveBeenCalled();
});

test.each([
  [{ success: true }, { ok: true }],
  [{ success: false, error: 'user_cancel' }, { ok: false, reason: 'cancelled' }],
  [{ success: false, error: 'passcode_not_set' }, { ok: false, reason: 'noLock' }],
  [{ success: false, error: 'not_available' }, { ok: false, reason: 'unavailable' }],
] as const)('a locked-out sensor hands over, and the screen lock answers %j as %j', async (answer, expected) => {
  authenticate.mockResolvedValue({ success: false, error: 'lockout' });
  jest.mocked(confirmDeviceCredential).mockResolvedValue(answer);

  expect(await (await stepUpFor('erase'))()).toEqual(expected);
  expect(confirmDeviceCredential).toHaveBeenCalledWith('Erase transactions I added');
});
