import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { fireEvent } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType, ReactNode } from 'react';

jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));
// expo-router/testing-library swaps Reanimated for its mock, which has no ReducedMotionConfig.
jest.mock('@/motion/policy', () => ({
  MotionPolicyRoot: ({ children }: { children: ReactNode }) => children,
}));
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

const APP = join(__dirname, '..', 'app');

const routes = Object.fromEntries(
  readdirSync(APP, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(APP, join(APP, f)).replace(/\.tsx$/, ''))
    .map((name) => [name, jest.requireActual<{ default: ComponentType }>(`@/app/${name}`).default]),
);

test('a wrong finger stays on Lock, then a matched finger unlocks into History', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  expect(screen.queryByText('HISTORY')).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
  await fireEvent.press(screen.getByRole('button', { name: 'UNLOCK' }));
  expect(screen.getByText('Not quite.')).toBeOnTheScreen();
  expect(screen.queryByText('HISTORY')).not.toBeOnTheScreen();

  authenticate.mockResolvedValueOnce({ success: true });
  await fireEvent.press(screen.getByRole('button', { name: 'UNLOCK' }));
  expect(authenticate).toHaveBeenLastCalledWith({
    promptMessage: 'Unlock Sen',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  expect(screen.getByText('HISTORY')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'UNLOCK' })).not.toBeOnTheScreen();
});
