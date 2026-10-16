import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { hideAmounts, lockNow } from '@/features/auth';
import type { OpenDb } from '@/services/db';
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
jest.mock('@/services/vault', () => ({ hasVault: jest.fn(), openVault: jest.fn() }));
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;

const APP = join(__dirname, '..', 'app');

const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`).default]),
);

test('Lock ignores a second tap while prompting, a wrong finger shows "Not quite.", a match opens History, a lock closes it', async () => {
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db });
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();

  let answer: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
  authenticate.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  await fireEvent.press(screen.getByRole('button', { name: "Checking it's you" }));
  expect(authenticate).toHaveBeenCalledTimes(1);

  answer({ success: false, error: 'authentication_failed' });
  expect(await screen.findByRole('header', { name: 'Not quite.' })).toBeOnTheScreen();
  expect(
    screen.getByText("Didn't match. 2 more tries before fingerprint locks."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Try fingerprint again' }));
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
  expect(screen.queryByRole('header', { name: 'Not quite.' })).not.toBeOnTheScreen();

  await act(() => lockNow());
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();
});

test('the app root drops revealed amounts whenever they are hidden', async () => {
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  await renderRouter(routes, { initialUrl: '/' });
  await act(() => writePref('hideAmounts', false));
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
  expect(readPage.mock.calls).toEqual([[vault, { filter: { flow: 'all', search: '' }, after: null }]]);

  screen.unmount();
  readPage.mockRestore();
  jest.useRealTimers();
});
