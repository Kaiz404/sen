import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import type * as ExpoLinking from 'expo-linking';
import {
  AppState,
  type AppStateStatus,
  type EmitterSubscription,
  Linking,
  type NativeEventSubscription,
} from 'react-native';

import { hideAmounts, lockNow, showAmounts } from '@/features/auth';
import { sessionStore } from '@/features/auth/session';
import { playMoment } from '@/features/sen';
import { InstantSchema, malaysiaDay } from '@/models/day';
import { draftSchema } from '@/models/draft';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import * as TxRepo from '@/services/tx-repo';
import * as Vault from '@/services/vault';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  getEnrolledLevelAsync: jest.fn(async () => 3),
}));
jest.mock('@/features/sen/director/store', () => {
  const actual = jest.requireActual('@/features/sen/director/store');
  return { ...actual, playMoment: jest.fn(actual.playMoment) };
});
jest.mock('@/services/vault', () => ({ hasVault: jest.fn(), openVault: jest.fn() }));
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

const APP = join(__dirname, '..', 'app');

const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`).default]),
);

test('Lock ignores a second tap while prompting, a failed check shows "Something went wrong.", a match opens History, a lock closes it', async () => {
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db: await openTestDb() });
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();

  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await fireEvent.press(screen.getByRole('button', { name: "Checking it's you" }));
  expect(authenticate).toHaveBeenCalledTimes(1);

  answer({ success: false, error: 'authentication_failed' });
  expect(await screen.findByRole('header', { name: 'Something went wrong.' })).toBeOnTheScreen();
  expect(screen.getByText("Sen couldn't check it's you. Try again.")).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Unlocked' })).toBeDisabled();
  expect(
    await screen.findByRole('button', { name: 'Add a transaction' }, { timeout: 3000 }),
  ).toBeOnTheScreen();
  expect(authenticate).toHaveBeenCalledTimes(2);
  expect(authenticate).toHaveBeenLastCalledWith({
    promptMessage: 'Unlock Sen',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  expect(screen.queryByRole('header', { name: 'Something went wrong.' })).not.toBeOnTheScreen();

  await act(() => lockNow());
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();
});

test('a detail link opened while locked shows Lock, then opens that receipt over History once unlocked', async () => {
  const vault = await openTestDb();
  const now = InstantSchema.parse(new Date().toISOString());
  const key = '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
  const draft = draftSchema(malaysiaDay(now)).parse({
    idemKey: key,
    amountMinor: 4250,
    direction: 'debit',
    description: 'Lunch with Hafiz, cash',
    category: 'food',
    day: malaysiaDay(now),
  });
  await TxRepo.insertManual(vault, draft, now);
  writePref('demo.datasetSize', 20);
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db: vault });
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValueOnce(`sen://transaction/m-${key}`);
  await renderRouter(routes, { initialUrl: `/transaction/m-${key}` });

  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.queryByText('Lunch with Hafiz, cash')).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  expect(await screen.findByText('RESIT', {}, { timeout: 3000 })).toBeOnTheScreen();
  expect(await screen.findByText(/^Added on this phone, /)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to history' }));
  expect(await screen.findByRole('button', { name: 'Add a transaction' })).toBeOnTheScreen();

  await act(() => lockNow());
});

type UrlListener = (event: { url: string }) => void;

/** Routes `url` and AppState events to every listener, the router's included, as the OS delivers them. */
function deliverLikeTheOs() {
  const urls = new Set<UrlListener>();
  const states = new Set<(state: AppStateStatus) => void>();
  const listen = (_type: string, listener: UrlListener) => {
    urls.add(listener);
    return { remove: () => urls.delete(listener) } as unknown as EmitterSubscription;
  };
  jest.spyOn(Linking, 'addEventListener').mockImplementation(listen);
  jest
    .spyOn(jest.requireMock<typeof ExpoLinking>('expo-linking'), 'addEventListener')
    .mockImplementation(listen);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    states.add(listener);
    return { remove: () => states.delete(listener) } as unknown as NativeEventSubscription;
  });
  return {
    open: (url: string) => urls.forEach((listener) => listener({ url })),
    appGoes: (state: AppStateStatus) => states.forEach((listener) => listener(state)),
  };
}

async function unlockedOnHistoryWithLunch(): Promise<string> {
  const vault = await openTestDb();
  const now = InstantSchema.parse(new Date().toISOString());
  const key = '2b9e4c61-0a7d-4f3e-9c8b-5d6e7f8a9b0c';
  const draft = draftSchema(malaysiaDay(now)).parse({
    idemKey: key,
    amountMinor: 4250,
    direction: 'debit',
    description: 'Lunch with Hafiz, cash',
    category: 'food',
    day: malaysiaDay(now),
  });
  await TxRepo.insertManual(vault, draft, now);
  writePref('demo.datasetSize', 20);
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  // A lock closes the database. The app opens a new one per unlock, so this one in-memory copy stays open.
  const reopened = { ...vault, close: async () => undefined };
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db: reopened });
  await renderRouter(routes, { initialUrl: '/' });
  await unlockToHistory();
  return `sen://transaction/m-${key}`;
}

async function unlockToHistory() {
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  expect(
    await screen.findByRole('button', { name: 'Add a transaction' }, { timeout: 3000 }),
  ).toBeOnTheScreen();
}

async function awayFor(os: ReturnType<typeof deliverLikeTheOs>, ms: number, url: string) {
  const left = Date.now();
  await act(() => os.appGoes('background'));
  const now = jest.spyOn(Date, 'now').mockReturnValue(left + ms);
  await act(async () => os.open(url));
  await act(() => os.appGoes('active'));
  now.mockRestore();
}

test('a detail link that brings the app back after the re-lock window shows Lock, then that receipt over History', async () => {
  const os = deliverLikeTheOs();
  const link = await unlockedOnHistoryWithLunch();

  await awayFor(os, 61_000, link);

  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.queryByText('Lunch with Hafiz, cash')).not.toBeOnTheScreen();
  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  expect(await screen.findByText('RESIT', {}, { timeout: 3000 })).toBeOnTheScreen();
  expect(await screen.findByText(/^Added on this phone, /)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to history' }));
  expect(await screen.findByRole('button', { name: 'Add a transaction' })).toBeOnTheScreen();

  await act(() => lockNow());
});

test('a detail link that brings the app back inside the re-lock window opens that receipt, and nothing is held for later', async () => {
  const os = deliverLikeTheOs();
  const link = await unlockedOnHistoryWithLunch();

  await awayFor(os, 30_000, link);

  expect(await screen.findByText('RESIT')).toBeOnTheScreen();
  expect(await screen.findByText(/^Added on this phone, /)).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Welcome back.' })).not.toBeOnTheScreen();

  await act(() => lockNow());
  await unlockToHistory();
  expect(screen.queryByText('RESIT')).not.toBeOnTheScreen();

  await act(() => lockNow());
});

test('the app root drops revealed amounts whenever they are hidden', async () => {
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  await renderRouter(routes, { initialUrl: '/' });
  await act(() => sessionStore.setState({ amountsHidden: false }));
  queryClient.setQueryData(['tx', 'revealed', 0], { t1: 4250 });

  await act(() => hideAmounts());

  expect(queryClient.getQueryData(['tx', 'revealed', 0])).toBeUndefined();
});

test('History’s first page is read as the unlock passes, while Lock holds for Unlock, not when History mounts', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  const vault = await openTestDb();
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db: vault });
  const readPage = jest.spyOn(TxRepo, 'readPage');
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await act(async () => {});

  expect(screen.getByRole('button', { name: 'Unlocked' })).toBeDisabled();
  expect(screen.queryByTestId('history')).not.toBeOnTheScreen();
  expect(readPage.mock.calls).toEqual([
    [vault, { filter: { flow: 'all', search: '' }, after: null }],
  ]);

  screen.unmount();
  readPage.mockRestore();
  jest.useRealTimers();
});

test('amounts shown before a lock are masked after the next unlock, on History and in Settings, with no Re-mask', async () => {
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest
    .mocked(Vault.openVault)
    .mockResolvedValueOnce({ kind: 'opened', db: await openTestDb() })
    .mockResolvedValueOnce({ kind: 'opened', db: await openTestDb() });
  sessionStore.setState(sessionStore.getInitialState());
  const played = jest.mocked(playMoment);
  played.mockClear();
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Welcome back.' });

  authenticate.mockResolvedValue({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await screen.findByRole('button', { name: 'Show amounts' }, { timeout: 20000 });
  await act(() => showAmounts());
  expect(await screen.findByRole('button', { name: 'Hide amounts' })).toBeOnTheScreen();

  await act(() => lockNow());
  await screen.findByRole('header', { name: 'Welcome back.' });
  expect(screen.getByText('Amounts stay hidden until you choose to show them.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));

  expect(await screen.findByRole('button', { name: 'Show amounts' }, { timeout: 20000 })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Hide amounts' })).not.toBeOnTheScreen();
  const moments = played.mock.calls.map(([, moment]) => moment);
  expect(moments).toContain('reveal');
  expect(moments).not.toContain('remask');

  await act(() => router.push('/settings'));
  const hide = await screen.findByRole('switch', { name: 'Hide amounts' });
  expect(hide.props.accessibilityState.checked).toBe(true);

});
