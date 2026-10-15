import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter, screen } from 'expo-router/testing-library';
import { fireEvent } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';
import HistoryScreen from '@/app/history';
import LockScreen from '@/app';

jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

const routes = { _layout: RootLayout, index: LockScreen, history: HistoryScreen };

test('a matched fingerprint unlocks into History', async () => {
  authenticate.mockResolvedValue({ success: true });
  await renderRouter(routes, { initialUrl: '/' });

  await fireEvent.press(screen.getByRole('button', { name: 'UNLOCK' }));

  expect(authenticate).toHaveBeenCalledWith({
    promptMessage: 'Unlock Sen',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  expect(screen.getByText('HISTORY')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'UNLOCK' })).not.toBeOnTheScreen();
});

test('a wrong finger stays on Lock and says so', async () => {
  authenticate.mockResolvedValue({ success: false, error: 'authentication_failed' });
  await renderRouter(routes, { initialUrl: '/' });

  await fireEvent.press(screen.getByRole('button', { name: 'UNLOCK' }));

  expect(screen.getByText('Not quite.')).toBeOnTheScreen();
  expect(screen.queryByText('HISTORY')).not.toBeOnTheScreen();
});
