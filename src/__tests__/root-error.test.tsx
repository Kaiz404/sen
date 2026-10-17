import { within } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureHandlerRootView: ({ children }: { children: unknown }) =>
    jest.requireActual('react').createElement(
      jest.requireActual('react-native').View,
      { testID: 'gesture-root' },
      children,
    ),
}));
jest.mock('@/components/toast', () => ({
  ...jest.requireActual('@/components/toast'),
  ToastHost: () => {
    if (mockBroken) throw new Error('toast host crashed, RM 1,234.50');
    return null;
  },
}));
jest.mock('@/services/vault', () => ({ hasVault: jest.fn(), openVault: jest.fn() }));

let mockBroken = true;

const rootLayout = jest.requireActual<typeof import('@/app/_layout')>(
  '@/app/_layout',
);

beforeEach(() => {
  mockBroken = true;
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
