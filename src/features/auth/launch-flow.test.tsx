import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent, within } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import type { ComponentType } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { OpenDb } from '@/services/db';
import { playHaptic } from '@/services/haptics';
import * as Vault from '@/services/vault';

import { launchStore } from './launch';
import { sessionStore } from './session';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  getEnrolledLevelAsync: jest.fn(async () => 3),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hide: jest.fn(),
}));
jest.mock('@/services/vault', () => ({ hasVault: jest.fn(), openVault: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const hidden = { includeHiddenElements: true };
/** Frame by frame, so a moment that starts from another's end callback starts on time. */
async function at(ms: number) {
  for (let left = ms; left > 0; left -= 16)
    await act(() => jest.advanceTimersByTime(Math.min(16, left)));
}

const APP = join(__dirname, '..', '..', 'app');
const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`).default]),
);

/** The phone lays the hero out, as Lock and Welcome do on their first frame. */
async function layOutHero() {
  await fireEvent(screen.getByTestId('hero'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 438 } },
  });
}

async function coldStart({ vault, url = '/' }: { vault: boolean; url?: string }) {
  jest.mocked(Vault.hasVault).mockResolvedValue(vault);
  await renderRouter(routes, { initialUrl: url });
  await at(0);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  sessionStore.setState(sessionStore.getInitialState());
  launchStore.setState(launchStore.getInitialState());
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db });
});
afterEach(() => jest.useRealTimers());

test('a cold start with a vault keeps the splash until Lock lays out, plays the launch over it, then shows Lock', async () => {
  await coldStart({ vault: true });
  expect(screen.getByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(SplashScreen.hide).not.toHaveBeenCalled();

  await layOutHero();
  expect(screen.getByTestId('launch', hidden)).toBeOnTheScreen();
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  await at(1520);
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['launch']]);
  await at(3276 - 1520 + 20);

  expect(screen.queryByTestId('launch', hidden)).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock with fingerprint' })).toBeEnabled();
});

test('a first run plays the launch into Welcome, whose Sen then waves hello', async () => {
  await coldStart({ vault: false });
  expect(screen.getByRole('header', { name: 'Meet Sen.' })).toBeOnTheScreen();

  await layOutHero();
  expect(screen.getByTestId('launch', hidden)).toBeOnTheScreen();
  await at(3300 + 1000);

  expect(screen.queryByTestId('launch', hidden)).not.toBeOnTheScreen();
  const paw = within(screen.getByTestId('sen-rig-welcome', hidden)).getByTestId('sen-pl', hidden);
  expect((paw.props.jestAnimatedProps.value.matrix as number[]).slice(4)).toEqual([-128, -180]);
});

test('with reduced motion the launch holds its rest frame, fades out by 600 ms and buzzes nothing', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
  await coldStart({ vault: true });
  await layOutHero();

  await at(400);
  expect(screen.getByTestId('launch', hidden)).toBeOnTheScreen();
  await at(220);

  expect(screen.queryByTestId('launch', hidden)).not.toBeOnTheScreen();
  expect(playHaptic).not.toHaveBeenCalled();
});

test('a cold start on a screen without a hero skips the launch and lifts the splash after 500 ms', async () => {
  await coldStart({ vault: true, url: '/dev/states' });
  await at(499);
  expect(SplashScreen.hide).not.toHaveBeenCalled();
  await at(1);

  expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('launch', hidden)).not.toBeOnTheScreen();
});

test('a match on Lock plays the Unlock moment on Lock’s Sen, and History opens when it ends', async () => {
  await coldStart({ vault: true });
  await layOutHero();
  await at(3300);
  authenticate.mockResolvedValueOnce({ success: true });

  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await at(260);
  const face = within(screen.getByTestId('sen-rig-lock', hidden)).getByTestId('sen-lk', hidden);
  expect((face.props.jestAnimatedProps.value.matrix as number[])[5]).toBeCloseTo(-14, 0);
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();
  await at(1370 - 260);

  expect(screen.getByRole('button', { name: 'Add a transaction' })).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Welcome back.' })).not.toBeOnTheScreen();
  expect(jest.mocked(playHaptic).mock.calls).toEqual([['launch'], ['unlock']]);
});
