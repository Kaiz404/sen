import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { cancelDeviceCredential, confirmDeviceCredential } from '@/services/device-credential';

import {
  authenticate,
  biometricOf,
  CREDENTIAL_TIMEOUT_MS,
  detectBiometric,
  type EnrolledLevel,
  isAuthOverride,
  promptAppState,
  PROMPT_TIMEOUT_MS,
  routeOf,
  SENSOR_OPTIONS,
  setAuthOverride,
} from './prompt';

jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(async () => undefined),
  getEnrolledLevelAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

const sensorOrSheet = jest.mocked(LocalAuthentication.authenticateAsync);
const credential = jest.mocked(confirmDeviceCredential);

const COMBINED = { biometricsSecurityLevel: 'strong', disableDeviceFallback: false } as const;

/** The phone the next prompt runs on. */
function phone(os: 'android' | 'ios', api = 33) {
  jest.replaceProperty(Platform, 'OS', os);
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(os === 'ios' ? '18.0' : api);
}

beforeEach(() => {
  sensorOrSheet.mockReset();
  credential.mockReset();
  jest.mocked(cancelDeviceCredential).mockClear();
  jest.mocked(LocalAuthentication.cancelAuthenticate).mockClear();
  phone('android', 33);
});
afterEach(() => jest.restoreAllMocks());

describe('the route', () => {
  test.each([
    // Strong enrolled: the combined sheet, except on Android 9 and 10, which refuse that pair.
    ['android', 24, 'strong', 'combined'],
    ['android', 27, 'strong', 'combined'],
    ['android', 28, 'strong', 'sensorThenCredential'],
    ['android', 29, 'strong', 'sensorThenCredential'],
    ['android', 30, 'strong', 'combined'],
    ['android', 36, 'strong', 'combined'],
    // No strong biometric: straight to the screen lock, at every level.
    ['android', 24, 'passcode', 'credential'],
    ['android', 29, 'weak', 'credential'],
    ['android', 33, 'weak', 'credential'],
    ['android', 36, 'passcode', 'credential'],
    // iOS: Face ID or Touch ID then the passcode in one sheet, or the passcode alone when no biometric is enrolled.
    ['ios', 18, 'strong', 'combined'],
    ['ios', 18, 'passcode', 'combined'],
  ] as const)('%s API %i with %s enrolled takes %s', (os, api, level, route) => {
    expect(routeOf(os, api, level)).toBe(route);
  });
});

describe('what is asked of the phone', () => {
  test.each([24, 27, 30, 36])('Android API %i with a strong biometric asks the combined sheet once', async (api) => {
    phone('android', api);
    sensorOrSheet.mockResolvedValueOnce({ success: true });

    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: true });
    expect(sensorOrSheet.mock.calls).toEqual([[{ promptMessage: 'Unlock Sen', ...COMBINED }]]);
    expect(credential).not.toHaveBeenCalled();
  });

  test.each([28, 29])('Android API %i asks the sensor alone, never the combined pair', async (api) => {
    phone('android', api);
    sensorOrSheet.mockResolvedValue({ success: true });

    await authenticate('Unlock Sen', 'strong');
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });
    await authenticate('Unlock Sen', 'strong');

    for (const [options] of sensorOrSheet.mock.calls) {
      expect(options).toEqual({ promptMessage: 'Unlock Sen', ...SENSOR_OPTIONS });
      expect(options?.disableDeviceFallback).toBe(true);
    }
  });

  test.each(['passcode', 'weak', 'none'] as const)(
    'Android with %s enrolled goes straight to the screen lock',
    async (level: EnrolledLevel) => {
      credential.mockResolvedValueOnce({ success: true });

      expect(await authenticate('Unlock Sen', level)).toEqual({ ok: true });
      expect(credential).toHaveBeenCalledWith('Unlock Sen');
      expect(sensorOrSheet).not.toHaveBeenCalled();
    },
  );

  test('iOS asks the one sheet that falls to the passcode', async () => {
    phone('ios');
    sensorOrSheet.mockResolvedValueOnce({ success: true });

    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: true });
    expect(sensorOrSheet.mock.calls).toEqual([[{ promptMessage: 'Unlock Sen', ...COMBINED }]]);
    expect(credential).not.toHaveBeenCalled();
  });
});

/**
 * The pair Android 9 and 10 reject, and that crashed the old prompt: a strong biometric beside a device fallback.
 * Expo's own default for the fallback is on, so a bare `strong` is the same pair.
 */
describe('the combined pair on every Android API level', () => {
  const API_LEVELS = Array.from({ length: 13 }, (_, i) => 24 + i);
  const ANSWERS = [
    { success: true },
    { success: false, error: 'lockout' },
    { success: false, error: 'user_cancel' },
    { success: false, error: 'not_available' },
    { success: false, error: 'not_enrolled' },
  ] as const;

  test.each(API_LEVELS)('API %i never asks for strong with a device fallback on 28 or 29', async (api) => {
    phone('android', api);
    for (const level of ['strong', 'weak', 'passcode', 'none'] as const) {
      for (const answer of ANSWERS) {
        sensorOrSheet.mockReset();
        sensorOrSheet.mockResolvedValue(answer);
        credential.mockResolvedValue({ success: true });
        await authenticate('Unlock Sen', level);
        for (const [options] of sensorOrSheet.mock.calls) {
          const pair =
            options?.biometricsSecurityLevel === 'strong' && options.disableDeviceFallback !== true;
          if (api === 28 || api === 29) expect(pair).toBe(false);
          // Below 28 and from 30 the pair is the route, and only a strong biometric takes it.
          if (pair) expect(level).toBe('strong');
        }
      }
    }
  });

  test.each([28, 29])('API %i with nothing but a screen lock never touches expo at all', async (api) => {
    phone('android', api);
    credential.mockResolvedValue({ success: true });

    await authenticate('Unlock Sen', 'passcode');

    expect(sensorOrSheet).not.toHaveBeenCalled();
  });
});

describe('a locked-out or unavailable sensor', () => {
  test('on Android 9 and 10 hands over to the screen lock, and says the sensor locked out', async () => {
    phone('android', 29);
    const lockedOut = jest.fn(() => true);
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });

    expect(await authenticate('Delete this transaction', 'strong', lockedOut)).toEqual({ ok: true });
    expect(lockedOut).toHaveBeenCalledWith('lockout');
    expect(credential).toHaveBeenCalledWith('Delete this transaction');
  });

  test('on Android 9 and 10 an unavailable sensor hands over, and says why it is unavailable', async () => {
    phone('android', 28);
    const heard = jest.fn(() => true);
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'not_available' });
    credential.mockResolvedValueOnce({ success: true });

    expect(await authenticate('Unlock Sen', 'strong', heard)).toEqual({ ok: true });
    expect(heard).toHaveBeenCalledWith('unavailable');
  });

  test('a cancel, or a hand-over the user then cancels, stays a cancel', async () => {
    phone('android', 29);
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: false, reason: 'cancelled' });
    expect(credential).not.toHaveBeenCalled();

    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: false, reason: 'cancelled' });
  });

  test('a lock that arrived meanwhile ends it as a cancel with no second prompt', async () => {
    phone('android', 29);
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'lockout' });

    expect(await authenticate('Unlock Sen', 'strong', () => false)).toEqual({
      ok: false,
      reason: 'cancelled',
    });
    expect(credential).not.toHaveBeenCalled();
  });

  test('a lockout the combined sheet still reports hands over too', async () => {
    sensorOrSheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });

    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: true });
  });
});

test.each([
  ['a cancel', 'user_cancel', { ok: false, reason: 'cancelled' }],
  ['no screen lock', 'passcode_not_set', { ok: false, reason: 'noLock' }],
  ['no biometric enrolled', 'not_enrolled', { ok: false, reason: 'unavailable' }],
  ['no hardware', 'not_available', { ok: false, reason: 'unavailable' }],
  ['a miss iOS reports', 'authentication_failed', { ok: false, reason: 'unknown' }],
  ['an iOS code outside the typed union', 'unknown: -1004, Not interactive', { ok: false, reason: 'unknown' }],
  ['a missing usage description', 'missing_usage_description', { ok: false, reason: 'unknown' }],
  ['a name on Object.prototype', 'toString', { ok: false, reason: 'unknown' }],
])('%s maps to its failure', async (_, error, expected) => {
  sensorOrSheet.mockResolvedValueOnce({
    success: false,
    error: error as LocalAuthentication.LocalAuthenticationError,
  });

  expect(await authenticate('Unlock Sen', 'strong')).toEqual(expected);
});

describe('the dev auth override', () => {
  const setDev = (on: boolean) => Object.assign(globalThis, { __DEV__: on });

  beforeEach(() => {
    sensorOrSheet.mockResolvedValue({ success: false, error: 'user_cancel' });
    credential.mockResolvedValue({ success: false, error: 'user_cancel' });
  });
  afterEach(() => {
    setDev(true);
    setAuthOverride('real');
  });

  test.each([
    ['pass', { ok: true }],
    ['cancel', { ok: false, reason: 'cancelled' }],
  ] as const)('%s answers in place of the native prompt, on every route', async (override, expected) => {
    setAuthOverride(override);

    expect(await authenticate('Unlock Sen', 'strong')).toEqual(expected);
    expect(await authenticate('Unlock Sen', 'weak')).toEqual(expected);
    expect(sensorOrSheet).not.toHaveBeenCalled();
    expect(credential).not.toHaveBeenCalled();
  });

  test('real asks the native prompt', async () => {
    setAuthOverride('pass');
    setAuthOverride('real');

    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: false, reason: 'cancelled' });
    expect(sensorOrSheet).toHaveBeenCalledTimes(1);
  });

  const ROUTES = [
    ['the combined sheet', 'android', 33, 'strong'],
    ['the sensor alone', 'android', 29, 'strong'],
    ['the screen lock', 'android', 33, 'passcode'],
    ['the iOS sheet', 'ios', 18, 'strong'],
  ] as const;

  test.each(ROUTES)('a release build reads no override that was set earlier, on %s', async (_, os, api, level) => {
    phone(os, api);
    setAuthOverride('pass');
    setDev(false);

    expect(await authenticate('Unlock Sen', level)).toEqual({ ok: false, reason: 'cancelled' });
    expect(sensorOrSheet.mock.calls.length + credential.mock.calls.length).toBe(1);
  });

  test.each(ROUTES)('a release build stores no override, on %s', async (_, os, api, level) => {
    phone(os, api);
    setDev(false);
    setAuthOverride('pass');
    setDev(true);

    expect(await authenticate('Unlock Sen', level)).toEqual({ ok: false, reason: 'cancelled' });
    expect(sensorOrSheet.mock.calls.length + credential.mock.calls.length).toBe(1);
  });

  test('a second prompt while the first is open is refused', async () => {
    setAuthOverride('pass');

    const [first, second] = await Promise.all([
      authenticate('Unlock Sen', 'strong'),
      authenticate('Delete', 'strong'),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, reason: 'cancelled' });
  });

  test.each([
    ['real', true],
    ['pass', true],
    ['cancel', true],
    ['lockout', false],
    ['fail', false],
    ['toString', false],
    ['PASS', false],
  ])('%s parses as an override: %s', (value, expected) => {
    expect(isAuthOverride(value)).toBe(expected);
  });
});

describe('a prompt the OS never answers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('the sensor alone times out after 60 s, and the next prompt is not refused as busy', async () => {
    phone('android', 29);
    sensorOrSheet.mockReturnValueOnce(new Promise(() => undefined));
    const first = authenticate('Unlock Sen', 'strong');

    await jest.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS - 1);
    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: false, reason: 'cancelled' });
    expect(sensorOrSheet).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(await first).toEqual({ ok: false, reason: 'timedOut' });
    expect(LocalAuthentication.cancelAuthenticate).toHaveBeenCalledTimes(1);
    sensorOrSheet.mockResolvedValueOnce({ success: true });
    expect(await authenticate('Unlock Sen', 'strong')).toEqual({ ok: true });
  });

  test('the combined sheet waits five minutes, since the user may switch to a slow pattern inside it', async () => {
    sensorOrSheet.mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen', 'strong');

    await jest.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(CREDENTIAL_TIMEOUT_MS - PROMPT_TIMEOUT_MS - 1);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
    expect(LocalAuthentication.cancelAuthenticate).toHaveBeenCalledTimes(1);
  });

  test('the screen lock waits five minutes and is cancelled through its own module', async () => {
    credential.mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen', 'passcode');

    await jest.advanceTimersByTimeAsync(CREDENTIAL_TIMEOUT_MS - 1);
    expect(cancelDeviceCredential).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
    expect(cancelDeviceCredential).toHaveBeenCalledTimes(1);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
  });

  test('does not count the time the system sheet holds the app inactive, as the Face ID and passcode sheets do', async () => {
    phone('android', 29);
    sensorOrSheet.mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen', 'strong');
    await jest.advanceTimersByTimeAsync(30_000);
    promptAppState('inactive');
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    promptAppState('active');

    await jest.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS - 1);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
  });

  test('does not count the time the app is in the background, but starts again when it returns', async () => {
    phone('android', 29);
    sensorOrSheet.mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen', 'strong');
    await jest.advanceTimersByTimeAsync(30_000);
    promptAppState('background');
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    promptAppState('active');

    await jest.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS - 1);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
  });
});

test.each([
  ['no screen lock', LocalAuthentication.SecurityLevel.NONE, 'none'],
  ['a passcode only', LocalAuthentication.SecurityLevel.SECRET, 'passcode'],
  ['a Class 2 biometric', LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK, 'weak'],
  ['strong biometrics', LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG, 'strong'],
])('%s maps to its enrolled level', async (_, level, expected) => {
  jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValueOnce(level);

  expect((await detectBiometric()).level).toBe(expected);
});

describe('a level read that throws', () => {
  test('on launch maps to the passcode, so Lock still offers its unlock key', async () => {
    jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockRejectedValueOnce(new Error('boom'));

    expect((await detectBiometric()).level).toBe('passcode');
  });

  test('on a re-check keeps the level from the last good read', async () => {
    jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockRejectedValueOnce(new Error('boom'));

    expect((await detectBiometric({ kind: 'fingerprint', level: 'strong' })).level).toBe('strong');
  });
});

describe('the sensor name', () => {
  test.each([
    ['android', [LocalAuthentication.AuthenticationType.FINGERPRINT], 'fingerprint'],
    ['android', [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION], 'face'],
    ['android', [LocalAuthentication.AuthenticationType.FINGERPRINT, LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION], 'biometrics'],
    ['android', [], 'biometrics'],
    ['ios', [LocalAuthentication.AuthenticationType.FINGERPRINT], 'touchId'],
    ['ios', [], 'faceId'],
  ] as const)('%s with %j is %s', (os, types, expected) => {
    expect(biometricOf(os, types)).toBe(expected);
  });
});
