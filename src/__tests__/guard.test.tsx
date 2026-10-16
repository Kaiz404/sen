import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { router, Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import NotFound from '@/app/+not-found';
import RootLayout from '@/app/_layout';
import type { RouteGate } from '@/features/auth';

let mockGate: RouteGate = 'locked';
jest.mock('@/features/auth', () => ({
  useRouteGate: () => mockGate,
  SessionRoot: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/features/settings', () => ({ useSenMotionPreference: () => 'full' }));
jest.mock('@/features/security', () => ({ useScreenGuard: () => undefined }));
jest.mock('@/components/toast', () => ({ ToastHost: () => null }));

const APP = join(__dirname, '..', 'app');
const SKIP_LOCKED_LINK_CHECK = new Set(['lock', 'welcome', 'primer', 'dev/states', '+not-found']);

const files = readdirSync(APP, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''));

const fake = (name: string) =>
  function FakeScreen() {
    return <Text>{`screen:${name}`}</Text>;
  };
function NestedLayout() {
  return <Stack />;
}

const REAL: Record<string, () => ReactNode> = { _layout: RootLayout, '+not-found': NotFound };

const routes = Object.fromEntries(
  files.map((name) => [name, REAL[name] ?? (name.endsWith('_layout') ? NestedLayout : fake(name))]),
);

const url = (name: string) => `/${name.replace(/(^|\/)index$/, '').replace('[id]', 'tx-1')}`;
const protectedRoutes = files.filter(
  (f) => !f.endsWith('_layout') && !SKIP_LOCKED_LINK_CHECK.has(f),
);

test('the route files on disk are the ones the layout declares', () => {
  expect([...files].sort()).toEqual([
    '+not-found',
    '_layout',
    'add/_layout',
    'add/details',
    'add/index',
    'add/review',
    'dev/states',
    'index',
    'lock',
    'primer',
    'settings/activity',
    'settings/erase',
    'settings/index',
    'settings/privacy',
    'settings/reset-demo',
    'settings/sign-out',
    'transaction/[id]/delete',
    'transaction/[id]/index',
    'welcome',
  ]);
});

test.each(protectedRoutes)('a deep link to %s while locked lands on Lock', async (name) => {
  mockGate = 'locked';
  await renderRouter(routes, { initialUrl: url(name) });

  expect(screen.getByText('screen:lock')).toBeOnTheScreen();
  expect(screen.queryByText(`screen:${name}`)).not.toBeOnTheScreen();
});

test('first run lands on Welcome, not Lock', async () => {
  mockGate = 'welcome';
  await renderRouter(routes, { initialUrl: '/transaction/tx-1' });

  expect(screen.getByText('screen:welcome')).toBeOnTheScreen();
});

test('unlocked opens the deep link', async () => {
  mockGate = 'unlocked';
  await renderRouter(routes, { initialUrl: '/transaction/tx-1' });

  expect(screen.getByText('screen:transaction/[id]/index')).toBeOnTheScreen();
});

test('the dev states route opens in a dev build while locked', async () => {
  mockGate = 'locked';
  await renderRouter(routes, { initialUrl: '/dev/states?screen=db' });

  expect(screen.getByText('screen:dev/states')).toBeOnTheScreen();
});

test('an unknown link while locked lands on Lock', async () => {
  mockGate = 'locked';
  await renderRouter(routes, { initialUrl: '/nowhere' });

  expect(screen.getByText('screen:lock')).toBeOnTheScreen();
});

test('an unknown link while unlocked goes home', async () => {
  mockGate = 'unlocked';
  await renderRouter(routes, { initialUrl: '/nowhere' });

  expect(await screen.findByText('screen:index')).toBeOnTheScreen();
});

test('navigating to a protected route while locked stays on Lock', async () => {
  mockGate = 'locked';
  await renderRouter(routes, { initialUrl: '/' });

  await act(async () => router.push('/transaction/tx-1'));

  expect(screen.getByText('screen:lock')).toBeOnTheScreen();
  expect(screen.queryByText(/Unmatched|Sitemap/)).not.toBeOnTheScreen();
});

test('in a release build the dev states link lands on Lock', async () => {
  const dev = globalThis as unknown as { __DEV__: boolean };
  dev.__DEV__ = false;
  try {
    mockGate = 'locked';
    await renderRouter(routes, { initialUrl: '/dev/states?screen=db' });

    expect(screen.getByText('screen:lock')).toBeOnTheScreen();
    expect(screen.queryByText('screen:dev/states')).not.toBeOnTheScreen();
  } finally {
    dev.__DEV__ = true;
  }
});
