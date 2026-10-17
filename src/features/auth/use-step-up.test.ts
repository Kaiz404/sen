import { renderHook } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import type { OpenDb } from '@/services/db';
import { confirmDeviceCredential } from '@/services/device-credential';

import type { Session } from './machine';
import { BIOMETRIC_OPTIONS } from './prompt';
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

  const options = { promptMessage: 'Delete this transaction', ...BIOMETRIC_OPTIONS };
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
  ['authentication_failed', 'mismatch'],
  ['lockout', 'lockout'],
  ['not_enrolled', 'not_set_up'],
  ['passcode_not_set', 'noLock'],
  ['not_available', 'unavailable'],
  ['timeout', 'unknown'],
  ['unknown', 'unknown'],
] as const)('%s fails the step-up as %s', async (error, reason) => {
  // The screen-lock try that follows a lockout, an off sensor or the sheet's own button gets the same answer.
  authenticate.mockResolvedValue({ success: false, error });
  jest.mocked(confirmDeviceCredential).mockResolvedValue({ success: false, error });

  expect(await (await stepUpFor('erase'))()).toEqual({ ok: false, reason });
});
