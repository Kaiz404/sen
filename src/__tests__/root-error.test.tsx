import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { act, fireEvent, within } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import { lockNow, showAmounts } from '@/features/auth';
import { openTestDb } from '@/services/db/testing/node-adapter';
import * as Vault from '@/services/vault';

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureHandlerRootView: ({ children }: { children: unknown }) =>
    jest
      .requireActual('react')
      .createElement(jest.requireActual('react-native').View, { testID: 'gesture-root' }, children),
}));
jest.mock('@/components/toast', () => ({
  ...jest.requireActual('@/components/toast'),
  ToastHost: () => {
    const hidden = jest.requireActual('@/features/auth').useAmountsHidden();
    if (mockBroken === 'always' || (mockBroken === 'revealed' && !hidden))
      throw new Error('toast host crashed, RM 1,234.50');
    return null;
  },
}));
jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  getEnrolledLevelAsync: jest.fn(async () => 3),
}));
jest.mock('@/services/vault', () => ({ hasVault: jest.fn(), openVault: jest.fn() }));

let mockBroken: 'always' | 'revealed' | 'never' = 'always';
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

const APP = join(__dirname, '..', 'app');
const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`)]),
);

const rootLayout = jest.requireActual<typeof import('@/app/_layout')>('@/app/_layout');

beforeEach(() => {
  mockBroken = 'always';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

test('a crash in the root layout shows both keys inside a gesture root, because the layout that held it is gone', async () => {
  await renderRouter(
    {
      _layout: rootLayout,
      index: () => <Text>screen:history</Text>,
    },
    { initialUrl: '/' },
  );

  const root = await screen.findByTestId('gesture-root');
  expect(within(root).getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  expect(within(root).getByRole('button', { name: 'Back to History' })).toBeOnTheScreen();
});

test('an error caught by the root boundary locks the session, so Try again goes through Lock', async () => {
  const vault = await openTestDb();
  const reopened = { ...vault, close: async () => undefined };
  jest.mocked(Vault.hasVault).mockResolvedValue(true);
  jest.mocked(Vault.openVault).mockResolvedValue({ kind: 'opened', db: reopened });
  mockBroken = 'never';
  await renderRouter(routes, { initialUrl: '/' });
  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock with fingerprint' }));
  expect(
    await screen.findByRole('button', { name: 'Add a transaction' }, { timeout: 3000 }),
  ).toBeOnTheScreen();

  mockBroken = 'revealed';
  authenticate.mockResolvedValueOnce({ success: true });
  await act(() => showAmounts());
  expect(await screen.findByRole('header', { name: 'Something went wrong.' })).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Sen hit a snag on this screen, so it locked to keep your money private. Try again, or go back to History.',
    ),
  ).toBeOnTheScreen();

  mockBroken = 'never';
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'Welcome back.' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock with fingerprint' }));
  expect(
    await screen.findByRole('button', { name: 'Add a transaction' }, { timeout: 3000 }),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Show amounts' })).toBeOnTheScreen();
  await act(() => lockNow());
});
