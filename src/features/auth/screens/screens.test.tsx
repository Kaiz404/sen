import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

import { clearPrefs, writePref } from '@/services/prefs';
import * as Vault from '@/services/vault';

import { sessionStore } from '../session';
import { LockScreen } from './lock-screen';
import { PrimerScreen } from './primer-screen';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/vault', () => ({ openVault: jest.fn(), destroyVault: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const session = () => sessionStore.getState().session;
const fingerprint = { kind: 'fingerprint', ready: true } as const;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  sessionStore.setState({ ...sessionStore.getInitialState(), biometric: fingerprint });
});

afterEach(() => jest.useRealTimers());

test('Lock promises hidden amounts only while the setting hides them', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  await render(<LockScreen />);
  expect(screen.getByText('Amounts stay hidden until you choose to show them.')).toBeOnTheScreen();

  await act(() => writePref('hideAmounts', false));

  expect(screen.getByText('Amounts show after you unlock, until you hide them.')).toBeOnTheScreen();
  expect(screen.queryByText(/stay hidden/)).not.toBeOnTheScreen();
});

test('a lockout counts down, then offers the fingerprint again', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'launch' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'lockout' });
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  expect(await screen.findByRole('header', { name: 'Too many tries.' })).toBeOnTheScreen();
  expect(screen.getByText('0:30')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Fingerprint back in 0:30' })).toBeDisabled();

  await act(() => jest.advanceTimersByTime(6_000));
  expect(screen.getByText('0:24')).toBeOnTheScreen();

  await act(() => jest.advanceTimersByTime(24_000));
  expect(screen.getByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock with fingerprint' })).toBeEnabled();
});

test('with no fingerprint enrolled, Lock says it is off and offers settings and the passcode', async () => {
  sessionStore.setState({
    session: { status: 'locked', reason: 'launch' },
    biometric: { kind: 'fingerprint', ready: false },
  });

  await render(<LockScreen />);

  expect(screen.getByRole('header', { name: 'Fingerprint is off.' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Open device settings' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Use device passcode' })).toBeOnTheScreen();
});

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

test('the first-run primer turns on the fingerprint and creates the vault', async () => {
  sessionStore.setState({ session: { status: 'welcome' } });
  const db = { close: jest.fn() };
  jest.mocked(Vault.openVault).mockResolvedValueOnce({ kind: 'created', db } as never);
  authenticate.mockResolvedValueOnce({ success: true });
  await render(<PrimerScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

  expect(session()).toEqual({ status: 'unlocked', since: 0, db });
});

test('a wrong finger on the primer keeps first run and says how many tries are left', async () => {
  sessionStore.setState({ session: { status: 'welcome' } });
  authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
  await render(<PrimerScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

  expect(
    await screen.findByText("Didn't match. 2 more tries before fingerprint locks."),
  ).toBeOnTheScreen();
  expect(session()).toEqual({ status: 'welcome' });
});
