import * as LocalAuthentication from 'expo-local-authentication';

import { cancelDeviceCredential, confirmDeviceCredential } from '@/services/device-credential';

import {
  authenticate,
  BIOMETRIC_OPTIONS,
  biometricOf,
  CREDENTIAL_TIMEOUT_MS,
  detectBiometric,
  promptAppState,
  isAuthOverride,
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

const authenticateAsync = jest.mocked(LocalAuthentication.authenticateAsync);

test.each([
  ['a known code', 'lockout', { ok: false, reason: 'lockout' }],
  [
    'an iOS code outside the typed union',
    'unknown: -1004, Not interactive',
    { ok: false, reason: 'unknown' },
  ],
  ['a missing usage description', 'missing_usage_description', { ok: false, reason: 'unknown' }],
  ['no screen lock', 'passcode_not_set', { ok: false, reason: 'noLock' }],
  ['a name on Object.prototype', 'toString', { ok: false, reason: 'unknown' }],
])('%s maps to its failure', async (_, error, expected) => {
  authenticateAsync.mockResolvedValueOnce({
    success: false,
    error: error as LocalAuthentication.LocalAuthenticationError,
  });

  expect(await authenticate('Unlock Sen')).toEqual(expected);
});

describe('the dev auth override', () => {
  const setDev = (on: boolean) => Object.assign(globalThis, { __DEV__: on });

  beforeEach(() => {
    authenticateAsync.mockReset();
    authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
  });
  afterEach(() => {
    setDev(true);
    setAuthOverride('real');
  });

  test.each([
    ['pass', { ok: true }],
    ['fail', { ok: false, reason: 'mismatch' }],
    ['cancel', { ok: false, reason: 'cancelled' }],
    ['lockout', { ok: false, reason: 'lockout' }],
  ] as const)('%s answers in place of the native prompt', async (override, expected) => {
    setAuthOverride(override);

    expect(await authenticate('Unlock Sen')).toEqual(expected);
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  test('real asks the native prompt', async () => {
    setAuthOverride('pass');
    setAuthOverride('real');

    expect(await authenticate('Unlock Sen')).toEqual({ ok: false, reason: 'cancelled' });
    expect(authenticateAsync.mock.calls).toEqual([
      [
        { promptMessage: 'Unlock Sen', ...BIOMETRIC_OPTIONS },
      ],
    ]);
  });

  test('a release build reads no override that was set earlier', async () => {
    setAuthOverride('pass');
    setDev(false);

    expect(await authenticate('Unlock Sen')).toEqual({ ok: false, reason: 'cancelled' });
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('a release build stores no override', async () => {
    setDev(false);
    setAuthOverride('pass');
    setDev(true);

    expect(await authenticate('Unlock Sen')).toEqual({ ok: false, reason: 'cancelled' });
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('a second prompt while the first is open is refused', async () => {
    setAuthOverride('pass');

    const [first, second] = await Promise.all([authenticate('Unlock Sen'), authenticate('Delete')]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, reason: 'cancelled' });
  });

  test.each([
    ['real', true],
    ['lockout', true],
    ['toString', false],
    ['PASS', false],
  ])('%s parses as an override: %s', (value, expected) => {
    expect(isAuthOverride(value)).toBe(expected);
  });
});

describe('a prompt the OS never answers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(LocalAuthentication.cancelAuthenticate).mockClear();
    authenticateAsync.mockReset();
    authenticateAsync.mockReturnValueOnce(new Promise(() => undefined));
  });
  afterEach(() => jest.useRealTimers());

  test('times out after 60 s, and the next prompt is not refused as busy', async () => {
    const first = authenticate('Unlock Sen');

    await jest.advanceTimersByTimeAsync(59_999);
    expect(await authenticate('Unlock Sen')).toEqual({ ok: false, reason: 'cancelled' });
    expect(authenticateAsync).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(await first).toEqual({ ok: false, reason: 'timedOut' });
    expect(LocalAuthentication.cancelAuthenticate).toHaveBeenCalledTimes(1);
    authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticate('Unlock Sen')).toEqual({ ok: true });
  });

  test('does not count the time the system sheet holds the app inactive, as the Face ID and passcode sheets do', async () => {
    const pending = authenticate('Unlock Sen');
    await jest.advanceTimersByTimeAsync(30_000);
    promptAppState('inactive');
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    promptAppState('active');

    await jest.advanceTimersByTimeAsync(59_999);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
  });

  test('does not count the time the app is in the background, but starts again when it returns', async () => {
    const pending = authenticate('Unlock Sen');
    await jest.advanceTimersByTimeAsync(30_000);
    promptAppState('background');
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    promptAppState('active');

    await jest.advanceTimersByTimeAsync(59_999);
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

describe('the screen-lock prompt on Android', () => {
  const { Platform } = jest.requireActual('react-native');
  beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(confirmDeviceCredential).mockReset();
    jest.mocked(cancelDeviceCredential).mockClear();
    jest.mocked(LocalAuthentication.cancelAuthenticate).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('waits five minutes where the sensor waits one, since the phone itself makes a user wait 30 s after five wrong tries', async () => {
    jest.mocked(confirmDeviceCredential).mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen', 'credential');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(cancelDeviceCredential).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(CREDENTIAL_TIMEOUT_MS - 60_001);
    expect(cancelDeviceCredential).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
    expect(cancelDeviceCredential).toHaveBeenCalledTimes(1);
    expect(LocalAuthentication.cancelAuthenticate).not.toHaveBeenCalled();
  });

  test('a sensor that stays silent for 60 s still times out as before', async () => {
    authenticateAsync.mockReset();
    authenticateAsync.mockReturnValueOnce(new Promise(() => undefined));
    const pending = authenticate('Unlock Sen');

    await jest.advanceTimersByTimeAsync(60_000);

    expect(await pending).toEqual({ ok: false, reason: 'timedOut' });
    expect(LocalAuthentication.cancelAuthenticate).toHaveBeenCalledTimes(1);
  });

  test('the dev override reaches the screen lock too: a lockout does not lock it', async () => {
    setAuthOverride('lockout');
    expect(await authenticate('Unlock Sen', 'credential')).toEqual({ ok: true });
    setAuthOverride('real');
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
