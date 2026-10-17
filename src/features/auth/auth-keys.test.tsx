import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { confirmDeviceCredential } from '@/services/device-credential';
import { clearPrefs } from '@/services/prefs';
import type { OpenDb } from '@/services/db';
import * as Vault from '@/services/vault';

import { BIOMETRIC_OPTIONS } from './prompt';
import { dispatch, sessionStore } from './session';
import { LockScreen } from './screens/lock-screen';
import { useStepUp } from './use-step-up';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(async () => undefined),
}));
jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
}));
jest.mock('@/services/vault', () => ({ openVault: jest.fn(), destroyVault: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const biometric = jest.mocked(LocalAuthentication.authenticateAsync);
const credential = jest.mocked(confirmDeviceCredential);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const session = () => sessionStore.getState().session;
const key = (name: string) => screen.getByRole('button', { name });

const onPlatform = (os: 'android' | 'ios') => jest.replaceProperty(Platform, 'OS', os);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  onPlatform('android');
  sessionStore.setState({
    ...sessionStore.getInitialState(),
    session: { status: 'locked', reason: 'launch' },
    biometric: { kind: 'fingerprint', level: 'strong' },
  });
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Unlock', () => {
  test('asks for the sensor alone, with a Cancel button and no device fallback', async () => {
    biometric.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with fingerprint'));

    expect(biometric.mock.calls).toEqual([
      [
        {
          promptMessage: 'Unlock Sen',
          biometricsSecurityLevel: 'strong',
          disableDeviceFallback: true,
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use passcode',
        },
      ],
    ]);
    expect(credential).not.toHaveBeenCalled();
  });

  test('five misses end in the Too many tries card, and Use screen lock opens Sen', async () => {
    biometric.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with fingerprint'));
    expect(await screen.findByRole('header', { name: 'Too many tries.' })).toBeOnTheScreen();
    expect(key('Fingerprint back in 0:30')).toBeDisabled();

    await fireEvent.press(key('Use screen lock'));

    expect(credential).toHaveBeenCalledWith('Unlock Sen');
    expect(biometric).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(2000));
    expect(session()).toEqual({ status: 'unlocked', since: 0, db });
  });
});

describe('Use screen lock', () => {
  test('opens the screen lock directly and never the biometric prompt', async () => {
    credential.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Use screen lock'));

    expect(credential).toHaveBeenCalledWith('Unlock Sen');
    expect(biometric).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(2000));
    expect(session()).toEqual({ status: 'unlocked', since: 0, db });
  });

  test('a cancel returns to Lock with both keys ready', async () => {
    credential.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await render(<LockScreen />);

    await fireEvent.press(key('Use screen lock'));

    expect(session()).toEqual({ status: 'locked', reason: 'launch' });
    expect(key('Unlock with fingerprint')).toBeEnabled();
    expect(key('Use screen lock')).toBeEnabled();
  });

  test('a phone with no screen lock gets the Set a screen lock view', async () => {
    credential.mockResolvedValueOnce({ success: false, error: 'passcode_not_set' });
    await render(<LockScreen />);

    await fireEvent.press(key('Use screen lock'));

    expect(await screen.findByRole('header', { name: 'Set a screen lock.' })).toBeOnTheScreen();
  });

  test('is labelled Use screen lock on Android and Use passcode on iOS, never PIN', async () => {
    const view = await render(<LockScreen />);
    expect(key('Use screen lock')).toBeOnTheScreen();
    expect(screen.queryByText(/PIN/)).not.toBeOnTheScreen();
    await view.unmount();

    onPlatform('ios');
    await render(<LockScreen />);
    expect(key('Use passcode')).toBeOnTheScreen();
  });

  test('on iOS opens the system sheet with its passcode fallback, not the biometric-only one', async () => {
    onPlatform('ios');
    biometric.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Use passcode'));

    expect(biometric.mock.calls).toEqual([[{ promptMessage: 'Unlock Sen', disableDeviceFallback: false }]]);
    expect(credential).not.toHaveBeenCalled();
  });

  test("the iOS sheet's own passcode button carries on to the passcode in the same unlock", async () => {
    onPlatform('ios');
    sessionStore.setState({ biometric: { kind: 'faceId', level: 'strong' } });
    biometric.mockResolvedValueOnce({ success: false, error: 'user_fallback' });
    biometric.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with Face ID'));

    expect(biometric.mock.calls.map(([options]) => options?.disableDeviceFallback)).toEqual([true, false]);
    await act(() => jest.advanceTimersByTime(2000));
    expect(session()).toEqual({ status: 'unlocked', since: 0, db });
  });
});

describe('a step-up', () => {
  const unlocked = { status: 'unlocked', since: 0, db } as const;
  const run = async () => (await renderHook(() => useStepUp('delete'))).result.current();
  beforeEach(() => {
    jest.useRealTimers();
    sessionStore.setState({ session: unlocked });
  });

  test.each(['lockout', 'not_enrolled', 'not_available'] as const)(
    'asks for the screen lock when the sensor answers %s',
    async (error) => {
      biometric.mockResolvedValueOnce({ success: false, error });
      credential.mockResolvedValueOnce({ success: true });

      expect(await run()).toEqual({ ok: true });
      expect(credential).toHaveBeenCalledWith('Delete this transaction');
    },
  );

  test.each(['user_cancel', 'authentication_failed'] as const)(
    'does not turn %s into a screen-lock prompt',
    async (error) => {
      biometric.mockResolvedValueOnce({ success: false, error });

      expect((await run()).ok).toBe(false);
      expect(credential).not.toHaveBeenCalled();
    },
  );

  test('a cancelled screen lock is a cancel, and a phone with no lock says so', async () => {
    biometric.mockResolvedValue({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await run()).toEqual({ ok: false, reason: 'cancelled' });

    credential.mockResolvedValueOnce({ success: false, error: 'passcode_not_set' });
    expect(await run()).toEqual({ ok: false, reason: 'noLock' });
  });

  test('a lock that arrives while the screen lock is up still applies afterwards', async () => {
    biometric.mockResolvedValueOnce({ success: false, error: 'lockout' });
    let answer: (result: { success: true }) => void = () => {};
    credential.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const pending = run();
    await act(async () => undefined);

    dispatch({ type: 'LOCK', reason: 'background' });
    answer({ success: true });

    expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
    expect(session()).toEqual({ status: 'locked', reason: 'background' });
  });
});

/** The pair Android 9 and 10 reject, and that crashed the old prompt: a strong biometric beside a device fallback. */
describe('the biometric options', () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

  test('never combine strong with a device fallback', () => {
    expect(BIOMETRIC_OPTIONS).toMatchObject({
      biometricsSecurityLevel: 'strong',
      disableDeviceFallback: true,
    });
    const offenders = sources(join(__dirname, '../..')).filter((path) =>
      (readFileSync(path, 'utf8').match(/\{[^{}]*\}/g) ?? []).some(
        (block) =>
          block.includes('biometricsSecurityLevel') && /disableDeviceFallback:\s*false/.test(block),
      ),
    );
    expect(offenders).toEqual([]);
  });

  test('are the only way Sen asks for the sensor', () => {
    const callers = sources(join(__dirname, '../..')).filter((path) =>
      /authenticateAsync\(/.test(readFileSync(path, 'utf8')),
    );
    expect(callers.map((path) => path.split('/').pop())).toEqual(['prompt.ts']);
  });
});
