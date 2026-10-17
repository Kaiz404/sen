import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Linking } from 'react-native';

import { sessionStore } from '../features/auth/session';
import { DayKeySchema, toInstant } from '@/models/day';
import { draftSchema } from '@/models/draft';
import { activity, readActivity } from '@/services/activity-log';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { queryClient, QK } from '@/services/query-client';
import { insertManual } from '@/services/tx-repo';
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
const phone = { key: null as string | null, file: false, db: null as OpenDb | null };
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
      phone.db = await openTestDb();
      return phone.db;
    },
    remove: async () => {
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
const TODAY = DayKeySchema.parse('2026-10-15');
const lunch = (n: number) =>
  draftSchema(TODAY).parse({
    idemKey: `0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a${n}`,
    amountMinor: 4250 + n,
    direction: 'debit',
    description: `Lunch number ${n}`,
    category: 'food',
    day: '2026-10-15',
  });

const db = () => phone.db!;
const countBySource = () =>
  db()
    .all('SELECT source, count(*) AS n FROM tx GROUP BY source ORDER BY source')
    .then((rows) => Object.fromEntries(rows.map((r) => [r.source, r.n])));

async function unlock() {
  phone.key = KEY;
  phone.file = true;
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
}

async function addRows(n: number) {
  for (let i = 1; i <= n; i++) await insertManual(db(), lunch(i), toInstant(new Date()));
  await act(() => queryClient.invalidateQueries({ queryKey: QK.tx }));
}

async function openEraseSheet(title = 'Erase transactions I added?') {
  await act(() => router.push('/settings/erase'));
  expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  authenticate.mockReset();
  sessionStore.setState(sessionStore.getInitialState());
});

test('erase deletes only the rows the user added, and leaves bank rows, the vault, the prefs and History in step', async () => {
  await unlock();
  await addRows(2);
  expect(await screen.findByText('Lunch number 1')).toBeOnTheScreen();
  const bank = (await countBySource()).bank;
  await openEraseSheet();
  expect(
    await screen.findByText(/Sen deletes the 2 transactions you added on this phone\. This can’t be undone\./),
  ).toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Erase with fingerprint');

  expect(await screen.findByText('Erased 2 transactions')).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText('Lunch number 1')).not.toBeOnTheScreen());
  expect(authenticate).toHaveBeenLastCalledWith({
    promptMessage: 'Erase transactions I added',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  expect(await countBySource()).toEqual({ bank });
  expect(phone).toMatchObject({ key: KEY, file: true });
  expect(readPref('theme')).toBe('dark');
  expect(sessionStore.getState().amountsHidden).toBe(false);
  await activity.settled();
  expect((await readActivity(db())).entries[0]?.event).toEqual({ code: 'tx.erased', count: 2 });
});

test('a finger that does not match erases nothing, says so, and the next try can erase', async () => {
  await unlock();
  await addRows(1);
  await openEraseSheet();

  authenticate.mockResolvedValueOnce(MISMATCH);
  await press('Erase with fingerprint');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Fingerprint didn’t match. Nothing was erased.',
  );
  expect((await countBySource()).manual).toBe(1);

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Try again with fingerprint');
  expect(await screen.findByText('Erased 1 transaction')).toBeOnTheScreen();
  expect((await countBySource()).manual).toBeUndefined();
});

test('a cancelled check leaves everything and the sheet as it was', async () => {
  await unlock();
  await addRows(1);
  await openEraseSheet();

  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  await press('Erase with fingerprint');
  await act(async () => {});

  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Erase with fingerprint' })).toBeEnabled();
  expect((await countBySource()).manual).toBe(1);
});

test('a delete that fails changes nothing, says so, and Try again can finish', async () => {
  await unlock();
  await addRows(2);
  await openEraseSheet();
  await db().run(
    "CREATE TRIGGER block_second BEFORE DELETE ON tx WHEN old.id LIKE '%5a2' BEGIN SELECT RAISE(ABORT, 'disk busy'); END",
  );
  const before = await db().all('SELECT * FROM tx ORDER BY id');

  authenticate.mockResolvedValueOnce({ success: true });
  await press('Erase with fingerprint');

  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t erase them. Nothing was changed.');
  expect(await db().all('SELECT * FROM tx ORDER BY id')).toEqual(before);
  await activity.settled();
  expect((await readActivity(db())).entries.map((e) => e.event.code)).not.toContain('tx.erased');

  await db().run('DROP TRIGGER block_second');
  authenticate.mockResolvedValueOnce({ success: true });
  await press('Try again with fingerprint');
  expect(await screen.findByText('Erased 2 transactions')).toBeOnTheScreen();
  expect((await countBySource()).manual).toBeUndefined();
});

test('with nothing added, the sheet says there is nothing to erase and the Settings row is off', async () => {
  await unlock();
  await openEraseSheet('Nothing to erase');
  expect(screen.queryByRole('button', { name: /Erase with/ })).not.toBeOnTheScreen();

  await press('Close');
  await act(() => router.push('/settings'));
  expect(
    await screen.findByRole('button', { name: 'Erase transactions I added' }),
  ).toBeDisabled();
});

test('a phone with the check turned off gets a way to its security settings', async () => {
  const opened = [
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(),
    jest.spyOn(Linking, 'sendIntent').mockResolvedValue(),
  ];
  await unlock();
  await addRows(1);
  await openEraseSheet();

  authenticate.mockResolvedValueOnce({ success: false, error: 'not_enrolled' });
  await press('Erase with fingerprint');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Fingerprint is off. Nothing was erased. Turn it on in your phone’s security settings, then try again.',
  );
  await press('Open device settings');
  expect(opened.map((spy) => spy.mock.calls.length)).toContain(1);
  expect((await countBySource()).manual).toBe(1);
});
