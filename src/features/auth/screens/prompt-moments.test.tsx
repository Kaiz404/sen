import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { ReactNode } from 'react';

import { MotionPolicyRoot } from '@/motion/policy';
import type { OpenDb } from '@/services/db';
import { playHaptic } from '@/services/haptics';
import { clearPrefs } from '@/services/prefs';
import * as Vault from '@/services/vault';

import { sessionStore } from '../session';
import { LockScreen } from './lock-screen';
import { PrimerScreen } from './primer-screen';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/vault', () => ({ openVault: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const session = () => sessionStore.getState().session;
const hidden = { includeHiddenElements: true };
const node = (sen: string, part: string) =>
  within(screen.getByTestId(`sen-rig-${sen}`, hidden)).getByTestId(`sen-${part}`, hidden).props
    .jestAnimatedProps.value;
const face = (sen: string) => (node(sen, 'lk').matrix as number[]).slice(4);
const eye = (sen: string) => (node(sen, 'elb').matrix as number[]).slice(0, 4);
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** A prompt the test answers by hand, as the phone's sheet would. */
function holdPrompt() {
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  return (result: LocalAuthentication.LocalAuthenticationResult) => act(async () => answer(result));
}

function Calm({ children }: { children: ReactNode }) {
  return <MotionPolicyRoot preference="calm">{children}</MotionPolicyRoot>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  sessionStore.setState({
    ...sessionStore.getInitialState(),
    session: { status: 'locked', reason: 'launch' },
    biometric: { kind: 'fingerprint', ready: true },
  });
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db });
});
afterEach(() => jest.useRealTimers());

test('while the prompt is open Lock’s Sen peeks left then right, and a cancel settles it masked', async () => {
  const answer = holdPrompt();
  await render(<LockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await at(300);
  expect(face('lock')).toEqual([-20, 24]);
  await at(800);
  expect(face('lock')).toEqual([20, 24]);

  await answer({ success: false, error: 'user_cancel' });
  await at(1500);
  expect(face('lock')).toEqual([0, 34]);
  expect(screen.getByRole('button', { name: 'Unlock with fingerprint' })).toBeEnabled();
});

test('a wrong finger pops Sen’s eyes open at 0.9 and drops the face to (0, 10), with the error haptic', async () => {
  const answer = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await at(300);

  await answer({ success: false, error: 'authentication_failed' });
  await at(100);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['authFailed']]);
  await at(600);

  expect(screen.getByRole('header', { name: 'Not quite.' })).toBeOnTheScreen();
  expect(face('lock')).toEqual([0, 10]);
  expect(eye('lock')).toEqual([0.9, 0, 0, 0.9]);
});

test('a lockout spins the napping Sen edge-on, a pill with its edge showing', async () => {
  const answer = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  await answer({ success: false, error: 'lockout' });
  await at(1400);

  expect(screen.getByRole('header', { name: 'Too many tries.' })).toBeOnTheScreen();
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['lockout']]);
  const spin = within(screen.getByTestId('sen-rig-lock', hidden)).getByTestId('sen-sp', hidden);
  const scaleX = (spin.props.jestAnimatedStyle.value.transform as { scaleX: number }[])[0]!.scaleX;
  expect(scaleX).toBeCloseTo(0.04, 2);
  expect(node('lock', 'edge').opacity).toBe(1);
});

test('a match keeps Lock up while Sen plays Unlock, then opens the vault to History at 1370 ms', async () => {
  const answer = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await at(300);

  await answer({ success: true });
  await at(260);
  expect(face('lock')[1]).toBeCloseTo(-14, 0);
  expect(screen.getByRole('button', { name: 'Unlocked' })).toBeDisabled();
  expect(session().status).toBe('arriving');
  await at(1370 - 260 - 1);
  expect(session().status).toBe('arriving');
  await at(1);

  expect(session()).toEqual({ status: 'unlocked', since: 300, db });
  expect(face('lock')).toEqual([0, -6]);
  expect(eye('lock')).toEqual([1.15, 0, 0, 0.45]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['unlock']]);
});

test('in Calm a match crossfades Sen into happy and opens History after 400 ms', async () => {
  const answer = holdPrompt();
  await render(
    <Calm>
      <LockScreen />
    </Calm>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  await answer({ success: true });
  await at(200);
  expect(face('lock')).toEqual([0, -6]);
  expect(session().status).toBe('arriving');
  await at(200);

  expect(session().status).toBe('unlocked');
});

test('the first-run primer’s Sen plays Unlock when the fingerprint is on, then History opens', async () => {
  sessionStore.setState({ session: { status: 'welcome' } });
  const answer = holdPrompt();
  await render(<PrimerScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

  await answer({ success: true });
  await at(260);
  expect(face('primer')[1]).toBeCloseTo(-14, 0);
  expect(screen.getByRole('button', { name: 'Fingerprint is on' })).toBeDisabled();
  await at(1110);

  expect(session().status).toBe('unlocked');
});
