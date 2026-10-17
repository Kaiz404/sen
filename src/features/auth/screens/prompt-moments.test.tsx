import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useSenAppGate } from '@/features/sen';
import { MotionPolicyRoot } from '@/motion/policy';
import type { OpenDb } from '@/services/db';
import { playHaptic } from '@/services/haptics';
import { clearPrefs } from '@/services/prefs';
import { confirmDeviceCredential } from '@/services/device-credential';
import * as Vault from '@/services/vault';

import { sessionStore } from '../session';
import { LockScreen } from './lock-screen';
import { PrimerScreen } from './primer-screen';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/device-credential', () => ({
  confirmDeviceCredential: jest.fn(),
  cancelDeviceCredential: jest.fn(async () => undefined),
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
const transform = (sen: string, part: string) =>
  Object.assign(
    {},
    ...(within(screen.getByTestId(`sen-rig-${sen}`, hidden)).getByTestId(`sen-${part}`, hidden)
      .props.jestAnimatedStyle.value.transform as object[]),
  ) as { scaleX: number; scaleY: number };
const spin = (sen: string) => transform(sen, 'sp').scaleX;
const squash = (sen: string) => {
  const { scaleX, scaleY } = transform(sen, 'sq');
  return [Math.round(scaleX * 1000) / 1000, Math.round(scaleY * 1000) / 1000];
};
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** A prompt the test answers by hand, as the phone's sheet would. */
function holdPrompt() {
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  return (result: LocalAuthentication.LocalAuthenticationResult) => act(async () => answer(result));
}

/** The screen-lock prompt, answered by hand. */
function holdCredential() {
  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  jest.mocked(confirmDeviceCredential).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  return (result: LocalAuthentication.LocalAuthenticationResult) => act(async () => answer(result));
}

function Calm({ children }: { children: ReactNode }) {
  return <MotionPolicyRoot preference="calm">{children}</MotionPolicyRoot>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.useFakeTimers({ now: 0 });
  clearPrefs();
  sessionStore.setState({
    ...sessionStore.getInitialState(),
    session: { status: 'locked', reason: 'launch' },
    biometric: { kind: 'fingerprint', level: 'strong' },
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

test('cancelling the next prompt after a miss settles Sen worried, with no second miss and no haptic', async () => {
  const miss = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await miss({ success: false, error: 'authentication_failed' });
  await at(2000);
  jest.mocked(playHaptic).mockClear();

  const cancel = holdPrompt();
  await fireEvent.press(screen.getByRole('button', { name: 'Try fingerprint again' }));
  await at(300);
  await cancel({ success: false, error: 'user_cancel' });
  await at(1500);

  expect(jest.mocked(playHaptic).mock.calls).toEqual([]);
  expect(screen.getByRole('header', { name: 'Not quite.' })).toBeOnTheScreen();
  expect((node('lock', 'el').matrix as number[]).slice(0, 4)).toEqual([0.85, 0, 0, 0.85]);
});

test('cancelling the passcode during a lockout sends the napping Sen back to breathing, with no second lockout', async () => {
  const lockout = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await lockout({ success: false, error: 'lockout' });
  await at(2000);
  jest.mocked(playHaptic).mockClear();

  const cancel = holdCredential();
  await fireEvent.press(screen.getByRole('button', { name: 'Use screen lock' }));
  await cancel({ success: false, error: 'user_cancel' });
  const frames = [];
  for (const ms of [1000, 1000, 3000]) {
    await at(ms);
    frames.push([spin('lock'), node('lock', 'edge').opacity, ...squash('lock')]);
  }

  // [spin scaleX, edge pill opacity, squash x, squash y] at 1, 2 and 5 s after the cancel.
  expect(frames).toEqual([
    [1, 0, 1, 1.02],
    [1, 0, 1, 1],
    [1, 0, 1, 1.02],
  ]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([]);
  expect(screen.getByRole('header', { name: 'Too many tries.' })).toBeOnTheScreen();
  expect(face('lock')).toEqual([0, 48]);
});

test('the napping Sen holds still in the background and breathes again when the app comes back', async () => {
  function Gated() {
    useSenAppGate();
    return <LockScreen />;
  }
  const appGoes = (state: 'background' | 'active') =>
    act(() => {
      for (const [, listener] of jest.mocked(AppState.addEventListener).mock.calls) listener(state);
    });
  const answer = holdPrompt();
  await render(<Gated />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await answer({ success: false, error: 'lockout' });
  await at(1300);
  await at(1000);
  expect(squash('lock')).toEqual([1, 1.02]);

  await appGoes('background');
  await at(1000);
  expect(squash('lock')).toEqual([1, 1]);
  await at(3000);
  expect(squash('lock')).toEqual([1, 1]);

  await appGoes('active');
  await at(1000);
  expect(squash('lock')).toEqual([1, 1.02]);
  expect(spin('lock')).toBe(1);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['lockout']]);
});

test('a lockout puts the napping Sen to sleep: one error haptic, a sigh, then a breath every 4 s, never edge-on', async () => {
  const answer = holdPrompt();
  await render(<LockScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  await answer({ success: false, error: 'lockout' });
  const frames = [];
  for (const ms of [400, 900, 1000, 2000, 2000, 1000, 3000]) {
    await at(ms);
    frames.push([spin('lock'), node('lock', 'edge').opacity, ...squash('lock')]);
  }

  // [spin scaleX, edge pill opacity, squash x, squash y] at 0.4, 1.3, 2.3, 4.3, 6.3, 7.3 and 10.3 s.
  expect(frames).toEqual([
    [1, 0, 1.04, 0.95],
    [1, 0, 1, 1],
    [1, 0, 1, 1.02],
    [1, 0, 1, 1],
    [1, 0, 1, 1.02],
    [1, 0, 1, 1],
    [1, 0, 1, 1.02],
  ]);
  expect(screen.getByRole('header', { name: 'Too many tries.' })).toBeOnTheScreen();
  expect(face('lock')).toEqual([0, 48]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['lockout']]);
});

test('in Calm a lockout fires the error haptic and the napping Sen rests asleep, with no sigh or breathing', async () => {
  const answer = holdPrompt();
  await render(
    <Calm>
      <LockScreen />
    </Calm>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  await answer({ success: false, error: 'lockout' });
  await at(400);
  expect(squash('lock')).toEqual([1, 1]);
  await at(1900);

  expect(squash('lock')).toEqual([1, 1]);
  expect(spin('lock')).toBe(1);
  expect(face('lock')).toEqual([0, 48]);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['lockout']]);
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

test('cancelling the primer’s next prompt after a miss plays no second miss and no haptic', async () => {
  sessionStore.setState({ session: { status: 'welcome' } });
  const miss = holdPrompt();
  await render(<PrimerScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));
  await miss({ success: false, error: 'authentication_failed' });
  await at(2000);
  jest.mocked(playHaptic).mockClear();

  const cancel = holdPrompt();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));
  await cancel({ success: false, error: 'user_cancel' });
  await at(1500);

  expect(jest.mocked(playHaptic).mock.calls).toEqual([]);
  expect(screen.getByText("Didn't match. Try fingerprint again, or use your screen lock.")).toBeOnTheScreen();
});
