import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { signOut } from '@/features/auth';
import { sessionStore } from '../features/auth/session';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import type { VaultPorts } from '@/services/vault';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  getEnrolledLevelAsync: jest.fn(async () => 3),
}));
jest.mock('@/services/logger');

jest.setTimeout(30_000);

const KEY = 'c'.repeat(64);
const phone = { key: null as string | null, file: false, diskFails: false };
const mockPorts: VaultPorts = {
  keys: {
    read: async () => phone.key,
    write: async (key) => {
      phone.key = key;
    },
    remove: async () => {
      phone.key = null;
    },
  },
  database: {
    open: async () => {
      phone.file = true;
      return openTestDb();
    },
    remove: async () => {
      if (phone.diskFails) throw new Error('disk busy');
      phone.file = false;
    },
    exists: () => phone.file,
  },
  randomBytes: (length) => new Uint8Array(length),
  clearPrefs: () => clearPrefs(),
};
jest.mock('@/services/vault', () => {
  const { createVault } = jest.requireActual<typeof import('@/services/vault')>('@/services/vault');
  const vault = () => createVault(mockPorts);
  return {
    hasVault: () => vault().hasVault(),
    openVault: () => vault().openVault(),
    destroyVault: () => vault().destroyVault(),
  };
});

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

const APP = join(__dirname, '..', 'app');
const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`).default]),
);

const MISMATCH = { success: false, error: 'authentication_failed' } as const;

async function openEraseSheet() {
  phone.key = KEY;
  phone.file = true;
  phone.diskFails = false;
  clearPrefs();
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  expect(
    await screen.findByRole('button', { name: 'Add a transaction' }, { timeout: 10_000 }),
  ).toBeOnTheScreen();
  writePref('theme', 'dark');
  await act(async () => sessionStore.setState({ amountsHidden: false }));
  await act(() => router.push('/settings/erase'));
  expect(
    await screen.findByRole('header', { name: 'Erase everything on this phone?' }),
  ).toBeOnTheScreen();
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  authenticate.mockReset();
  sessionStore.setState(sessionStore.getInitialState());
});

test('erase asks for the check, then leaves no vault key, no database file and no prefs, and shows Welcome', async () => {
  await openEraseSheet();

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Erase with fingerprint');

  expect(
    await screen.findByRole('header', { name: 'THREE THINGS SEN PROMISES' }),
  ).toBeOnTheScreen();
  expect(authenticate).toHaveBeenLastCalledWith({
    promptMessage: 'Erase everything on this phone',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  expect(phone).toMatchObject({ key: null, file: false });
  expect(readPref('theme')).toBe('system');
  expect(sessionStore.getState().amountsHidden).toBe(true);
});

test('a finger that does not match erases nothing, says so, and the next try can erase', async () => {
  await openEraseSheet();

  authenticate.mockResolvedValueOnce(MISMATCH);
  await press('Erase with fingerprint');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Fingerprint didn’t match. Nothing was erased.',
  );
  expect(phone).toMatchObject({ key: KEY, file: true });
  expect(readPref('theme')).toBe('dark');

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Try again with fingerprint');
  expect(
    await screen.findByRole('header', { name: 'THREE THINGS SEN PROMISES' }),
  ).toBeOnTheScreen();
  expect(phone).toMatchObject({ key: null, file: false });
});

test('a cancelled check leaves everything and the sheet as it was', async () => {
  await openEraseSheet();

  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  await press('Erase with fingerprint');
  await act(async () => {});

  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Erase with fingerprint' })).toBeEnabled();
  expect(phone).toMatchObject({ key: KEY, file: true });
});

test('a disk that fails mid-wipe lands on Lock with a message, the key already gone, and the wipe can finish', async () => {
  await openEraseSheet();
  phone.diskFails = true;

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Erase with fingerprint');

  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(await screen.findByText('Couldn’t finish erasing')).toBeOnTheScreen();
  expect(screen.getByText('On the lock screen, tap Start again to finish.')).toBeOnTheScreen();
  expect(phone.key).toBeNull();
  expect(phone.file).toBe(true);

  phone.diskFails = false;
  await act(() => signOut());
  expect(
    await screen.findByRole('header', { name: 'THREE THINGS SEN PROMISES' }),
  ).toBeOnTheScreen();
  expect(phone).toMatchObject({ key: null, file: false });
});
