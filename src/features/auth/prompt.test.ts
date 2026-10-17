import * as LocalAuthentication from 'expo-local-authentication';

import {
  authenticate,
  detectBiometric,
  promptAppState,
  isAuthOverride,
  setAuthOverride,
} from './prompt';

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
        {
          promptMessage: 'Unlock Sen',
          biometricsSecurityLevel: 'strong',
          disableDeviceFallback: false,
        },
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

  test('is cancelled after 60 s, and the next prompt is not refused as busy', async () => {
    const first = authenticate('Unlock Sen');

    await jest.advanceTimersByTimeAsync(59_999);
    expect(await authenticate('Unlock Sen')).toEqual({ ok: false, reason: 'cancelled' });
    expect(authenticateAsync).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(await first).toEqual({ ok: false, reason: 'cancelled' });
    expect(LocalAuthentication.cancelAuthenticate).toHaveBeenCalledTimes(1);
    authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticate('Unlock Sen')).toEqual({ ok: true });
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

    expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
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
