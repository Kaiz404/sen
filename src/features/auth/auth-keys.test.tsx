import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { activity } from '@/services/activity-log';
import { confirmDeviceCredential } from '@/services/device-credential';
import type { OpenDb } from '@/services/db';
import { clearPrefs } from '@/services/prefs';
import * as Vault from '@/services/vault';

import type { Biometric } from './prompt';
import { LockView, type LockState } from './screens/lock-screen';
import { LockScreen } from './screens/lock-screen';
import { dispatch, sessionStore } from './session';
import { stepUp } from './use-step-up';

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

const sheet = jest.mocked(LocalAuthentication.authenticateAsync);
const credential = jest.mocked(confirmDeviceCredential);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const session = () => sessionStore.getState().session;
const key = (name: string) => screen.getByRole('button', { name });
const COMBINED = { biometricsSecurityLevel: 'strong', disableDeviceFallback: false } as const;

function phone(os: 'android' | 'ios', api = 33) {
  jest.replaceProperty(Platform, 'OS', os);
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(os === 'ios' ? '18.0' : api);
}

beforeEach(() => {
  jest.clearAllMocks();
  sheet.mockReset();
  credential.mockReset();
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  phone('android');
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

const settle = () => act(() => jest.advanceTimersByTime(2000));

describe('Lock has exactly one auth key', () => {
  const STORE = { kind: 'store', cause: 'store', failures: 2, firstAt: 0, lastAt: 0 } as const;
  const STATES: readonly LockState[] = [
    { kind: 'idle' },
    { kind: 'checking' },
    { kind: 'timedOut' },
    { kind: 'noLock' },
    { kind: 'error' },
    STORE,
    { kind: 'signingOut' },
    { kind: 'unlocked' },
  ];
  const SENSORS: readonly (Biometric | null)[] = ['fingerprint', 'face', 'biometrics', 'faceId', null];

  test.each(STATES.map((state) => [state.kind, state] as const))(
    'in the %s state, with any sensor or none',
    async (_, state) => {
      for (const biometric of SENSORS) {
        const view = await render(
          <LockView
            state={state}
            biometric={biometric}
            onUnlock={() => {}}
            onOpenLockSettings={() => {}}
            onStartAgain={() => {}}
            onReset={() => {}}
          />,
        );
        expect(screen.getAllByTestId('unlock')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: /^Use (screen lock|passcode|device)/ })).toBeNull();
        if (biometric !== 'faceId') expect(screen.queryByText(/Face ID|PIN/)).toBeNull();
        await view.unmount();
      }
    },
  );
});

describe('Unlock on Android', () => {
  test('API 30 and later with a strong biometric asks the combined sheet once', async () => {
    sheet.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with fingerprint'));

    expect(sheet.mock.calls).toEqual([[{ promptMessage: 'Unlock Sen', ...COMBINED }]]);
    expect(credential).not.toHaveBeenCalled();
    await settle();
    expect(session()).toEqual({ status: 'unlocked', since: 0, db });
  });

  test.each(['passcode', 'weak'] as const)(
    'with %s enrolled the key just says Unlock, and the phone asks for its screen lock',
    async (level) => {
      sessionStore.setState({ biometric: { kind: 'face', level } });
      credential.mockResolvedValueOnce({ success: true });
      await render(<LockScreen />);

      expect(screen.queryByText(/is off/)).toBeNull();
      await fireEvent.press(key('Unlock'));

      expect(credential).toHaveBeenCalledWith('Unlock Sen');
      expect(sheet).not.toHaveBeenCalled();
      await settle();
      expect(session()).toEqual({ status: 'unlocked', since: 0, db });
    },
  );

  test('API 29 with a strong biometric asks the sensor alone, and a lockout hands over to the screen lock', async () => {
    phone('android', 29);
    sheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with fingerprint'));

    expect(sheet.mock.calls[0]?.[0]).toMatchObject({ disableDeviceFallback: true, cancelLabel: 'Cancel' });
    expect(credential).toHaveBeenCalledWith('Unlock Sen');
    await settle();
    expect(session()).toEqual({ status: 'unlocked', since: 0, db });
  });

  test('a cancel returns to Lock with the key ready and nothing said', async () => {
    sheet.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock with fingerprint'));

    expect(session()).toEqual({ status: 'locked', reason: 'launch' });
    expect(key('Unlock with fingerprint')).toBeEnabled();
    expect(screen.queryByText(/timed out|went wrong/)).toBeNull();
  });

  test('a phone with no screen lock gets the Set a screen lock view', async () => {
    sessionStore.setState({ biometric: { kind: 'fingerprint', level: 'passcode' } });
    credential.mockResolvedValueOnce({ success: false, error: 'passcode_not_set' });
    await render(<LockScreen />);

    await fireEvent.press(key('Unlock'));

    expect(await screen.findByRole('header', { name: 'Set a screen lock.' })).toBeOnTheScreen();
  });

  test('never says PIN or Face ID', async () => {
    await render(<LockScreen />);
    expect(screen.queryByText(/PIN|Face ID/)).toBeNull();
  });
});

describe('Unlock on iOS', () => {
  test('asks the one sheet that falls to the passcode, and there is no second key', async () => {
    phone('ios');
    sessionStore.setState({ biometric: { kind: 'faceId', level: 'strong' } });
    sheet.mockResolvedValueOnce({ success: true });
    await render(<LockScreen />);

    expect(screen.queryByRole('button', { name: /passcode/ })).toBeNull();
    await fireEvent.press(key('Unlock with Face ID'));

    expect(sheet.mock.calls).toEqual([[{ promptMessage: 'Unlock Sen', ...COMBINED }]]);
  });
});

describe('a step-up takes the same route', () => {
  const unlocked = { status: 'unlocked', since: 0, db } as const;
  const run = () => stepUp('delete');
  beforeEach(() => {
    jest.useRealTimers();
    sessionStore.setState({ session: unlocked });
  });

  test('API 30 and later: the combined sheet', async () => {
    sheet.mockResolvedValueOnce({ success: true });

    expect(await run()).toEqual({ ok: true });
    expect(sheet.mock.calls).toEqual([[{ promptMessage: 'Delete this transaction', ...COMBINED }]]);
    expect(credential).not.toHaveBeenCalled();
  });

  test('API 29: the sensor, then the screen lock on a lockout', async () => {
    phone('android', 29);
    sheet.mockResolvedValueOnce({ success: false, error: 'lockout' });
    credential.mockResolvedValueOnce({ success: true });

    expect(await run()).toEqual({ ok: true });
    expect(credential).toHaveBeenCalledWith('Delete this transaction');
  });

  test('no strong biometric: straight to the screen lock', async () => {
    sessionStore.setState({ biometric: { kind: 'face', level: 'weak' } });
    credential.mockResolvedValueOnce({ success: true });

    expect(await run()).toEqual({ ok: true });
    expect(sheet).not.toHaveBeenCalled();
  });

  test('a cancelled screen lock is a cancel, and a phone with no lock says so', async () => {
    sessionStore.setState({ biometric: { kind: 'face', level: 'passcode' } });
    credential.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await run()).toEqual({ ok: false, reason: 'cancelled' });

    credential.mockResolvedValueOnce({ success: false, error: 'passcode_not_set' });
    expect(await run()).toEqual({ ok: false, reason: 'noLock' });
  });

  test('a lock that arrived while the sensor prompt was up ends a lockout without asking for the screen lock', async () => {
    let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
    sheet.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const record = jest.spyOn(activity, 'record');
    const pending = run();
    await act(async () => undefined);

    dispatch({ type: 'LOCK', reason: 'background' });
    answer({ success: false, error: 'lockout' });

    expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
    expect(credential).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: 'auth.failed' }));
    expect(session()).toEqual({ status: 'locked', reason: 'background' });
  });

  test('a lock that arrives while the prompt is up still applies afterwards', async () => {
    let answer: (result: { success: true }) => void = () => {};
    sheet.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const pending = run();
    await act(async () => undefined);

    dispatch({ type: 'LOCK', reason: 'background' });
    answer({ success: true });

    expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
    expect(session()).toEqual({ status: 'locked', reason: 'background' });
  });
});

describe('who asks the phone', () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
  test('only prompt.ts calls authenticateAsync, so every ask goes through the route table', () => {
    const callers = sources(join(__dirname, '../..')).filter((path) =>
      /authenticateAsync\(/.test(readFileSync(path, 'utf8')),
    );
    expect(callers.map((path) => path.split('/').pop())).toEqual(['prompt.ts']);
  });
});
