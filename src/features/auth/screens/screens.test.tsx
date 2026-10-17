import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Linking, Platform } from 'react-native';

import { clearPrefs } from '@/services/prefs';
import { KeyUnreadableError } from '@/services/store-fault';
import * as Vault from '@/services/vault';

import { sessionStore } from '../session';
import { LockScreen } from './lock-screen';
import { PrimerScreen } from './primer-screen';
import { WelcomeScreen } from './welcome-screen';

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

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const session = () => sessionStore.getState().session;
const fingerprint = { kind: 'fingerprint', level: 'strong' } as const;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  sessionStore.setState({ ...sessionStore.getInitialState(), biometric: fingerprint });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('Lock promises hidden amounts, and no longer offers to keep them shown', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  await render(<LockScreen />);

  expect(screen.getByText('Amounts stay hidden until you choose to show them.')).toBeOnTheScreen();
  expect(screen.queryByText(/until you hide them/)).not.toBeOnTheScreen();
});

test('Lock’s hero starts below the status bar', async () => {
  await render(<LockScreen />);
  expect(screen.getByTestId('hero')).toHaveStyle({ paddingTop: 48 + 26 });
});

describe('a vault that will not open', () => {
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

  async function failOpens(error: Error, times: number, header = "Can't open its store.") {
    sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
    await render(<LockScreen />);
    for (let i = 0; i < times; i++) {
      authenticate.mockResolvedValueOnce({ success: true });
      jest.mocked(Vault.openVault).mockRejectedValueOnce(error);
      await press(i === 0 ? 'Unlock with fingerprint' : 'Try again');
      await screen.findByRole('header', { name: header });
    }
  }

  test('Lock names the store, not the fingerprint, and offers no reset on the first failure', async () => {
    await failOpens(new Error('migration 2 failed'), 1);

    expect(
      screen.getByText("Sen's data on this phone wouldn't open. Nothing was shown."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/couldn't check it's you/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reset Sen on this phone' })).not.toBeOnTheScreen();
  });

  test('after two failures Lock offers a reset that confirms, says what it costs, and starts fresh', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await failOpens(new Error('migration 2 failed'), 2);
    expect(
      screen.getByText('Your bank history syncs back. Rows you added are erased.'),
    ).toBeOnTheScreen();

    await press('Reset Sen on this phone');
    expect(Vault.destroyVault).not.toHaveBeenCalled();
    expect(alert.mock.lastCall?.[0]).toBe('Reset Sen on this phone?');
    const reset = alert.mock.lastCall?.[2]?.find((button) => button.text === 'Reset Sen');
    await act(async () => reset?.onPress?.());

    expect(Vault.destroyVault).toHaveBeenCalledTimes(1);
    expect(session()).toEqual({ status: 'welcome' });
  });

  test('two quick failures to read the key offer no reset, since a busy keystore clears by itself', async () => {
    await failOpens(new KeyUnreadableError({ cause: new Error('keystore busy') }), 2);

    expect(screen.queryByRole('button', { name: 'Reset Sen on this phone' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  test('a full disk says so and never offers to wipe the store', async () => {
    await failOpens(new Error('Error code 13: database or disk is full'), 2, 'Phone is full.');

    expect(
      screen.getByText('Your phone is out of space. Free some up, then try again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reset Sen on this phone' })).not.toBeOnTheScreen();
  });

  test('the first run says the same on the primer', async () => {
    sessionStore.setState({ session: { status: 'welcome' } });
    authenticate.mockResolvedValueOnce({ success: true });
    jest
      .mocked(Vault.openVault)
      .mockRejectedValueOnce(new Error('Error code 13: database or disk is full'));
    await render(<PrimerScreen />);

    await press('Turn on fingerprint');

    expect(
      await screen.findByText('Your phone is out of space. Free some up, then try again.'),
    ).toBeOnTheScreen();
  });
});

describe('a phone with no screen lock', () => {
  const noLock = { kind: 'fingerprint', level: 'none' } as const;
  beforeEach(() => {
    jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  });

  test('Lock asks for a screen lock with one key to its settings and no passcode key', async () => {
    sessionStore.setState({ session: { status: 'locked', reason: 'launch' }, biometric: noLock });
    await render(<LockScreen />);

    expect(screen.getByRole('header', { name: 'Set a screen lock.' })).toBeOnTheScreen();
    expect(screen.getByText(/^Set a screen lock to use Sen\./)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Use screen lock' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Open lock-screen settings' }));
    expect(Linking.sendIntent).toHaveBeenCalledWith('android.app.action.SET_NEW_PASSWORD');
  });

  test('setting one and coming back clears the message', async () => {
    sessionStore.setState({ session: { status: 'locked', reason: 'launch' }, biometric: noLock });
    await render(<LockScreen />);

    await act(() => sessionStore.setState({ biometric: fingerprint }));

    expect(screen.getByRole('button', { name: 'Unlock with fingerprint' })).toBeEnabled();
  });

  test('the primer sends the settings key to the lock-screen settings and offers no passcode to use', async () => {
    sessionStore.setState({ session: { status: 'welcome' }, biometric: noLock });
    await render(<PrimerScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open lock-screen settings' }));
    expect(Linking.sendIntent).toHaveBeenCalledWith('android.app.action.SET_NEW_PASSWORD');
  });

  test('Welcome swaps Continue for the same key', async () => {
    sessionStore.setState({ session: { status: 'welcome' }, biometric: noLock });
    await render(<WelcomeScreen />);

    expect(screen.getByText('Set a screen lock to use Sen.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open lock-screen settings' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Continue as demo user' })).not.toBeOnTheScreen();
  });
});

test('a sensor prompt that never answers frees Lock after 60 s and says the check timed out', async () => {
  // Android 9 and 10 ask the sensor alone, which keeps the 60 s clock. The combined sheet waits five minutes.
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29);
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockReturnValueOnce(new Promise(() => undefined));
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  expect(screen.getByRole('button', { name: "Checking it's you" })).toBeDisabled();
  await act(async () => jest.advanceTimersByTime(60_000));

  expect(
    screen.getByText('The check timed out. Try again.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Try fingerprint again' })).toBeEnabled();
  expect(screen.queryByText(/Too many tries/)).not.toBeOnTheScreen();
  expect(session()).toEqual({ status: 'locked', reason: 'launch' });
}, 30_000);

test('a cancelled prompt returns to Lock without a message', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  expect(await screen.findByRole('button', { name: 'Unlock with fingerprint' })).toBeEnabled();
  expect(screen.getByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(session()).toEqual({ status: 'locked', reason: 'launch' });
});

test('an error code outside the typed union shows the generic error, not a crash', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({
    success: false,
    error: 'unknown: -1004, Not interactive' as LocalAuthentication.LocalAuthenticationError,
  });
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  expect(await screen.findByRole('header', { name: 'Something went wrong.' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});

test('"Not you? Start again" confirms, destroys the vault and returns to Welcome', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  const alert = jest.spyOn(Alert, 'alert');
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Not you? Start again' }));
  const startAgain = alert.mock.lastCall?.[2]?.find((button) => button.text === 'Start again');
  await act(async () => startAgain?.onPress?.());

  expect(alert.mock.lastCall?.[0]).toBe('Start again?');
  expect(Vault.destroyVault).toHaveBeenCalledTimes(1);
  expect(session()).toEqual({ status: 'welcome' });
});

test('while "Start again" erases the vault, every key on Lock is disabled', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  let finish: () => void = () => {};
  jest
    .mocked(Vault.destroyVault)
    .mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
  const alert = jest.spyOn(Alert, 'alert');
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not you? Start again' }));
  const startAgain = alert.mock.lastCall?.[2]?.find((button) => button.text === 'Start again');

  await act(async () => startAgain?.onPress?.());

  expect(screen.getByRole('button', { name: 'Unlock with fingerprint' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Not you? Start again' })).toBeDisabled();
  await act(async () => finish());
  expect(session()).toEqual({ status: 'welcome' });
});

test('the first-run primer turns on the fingerprint and creates the vault', async () => {
  sessionStore.setState({ session: { status: 'welcome' } });
  const db = { close: jest.fn() };
  jest.mocked(Vault.openVault).mockResolvedValueOnce({ kind: 'created', db } as never);
  authenticate.mockResolvedValueOnce({ success: true });
  await render(<PrimerScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));
  expect(session()).toEqual({ status: 'arriving', purpose: 'setup', since: 0, db });
  await act(() => jest.advanceTimersByTime(1370));

  expect(session()).toEqual({ status: 'unlocked', since: 0, db });
});

test('the primer says the check timed out and keeps its key ready', async () => {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29);
  sessionStore.setState({ session: { status: 'welcome' } });
  authenticate.mockReturnValueOnce(new Promise(() => undefined));
  await render(<PrimerScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));
  await act(async () => jest.advanceTimersByTime(60_000));

  expect(
    screen.getByText('The check timed out. Try again.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Turn on fingerprint' })).toBeEnabled();
}, 30_000);

