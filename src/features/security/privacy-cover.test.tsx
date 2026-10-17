import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { coverShown, PrivacyCover } from './privacy-cover';

let mockPromptAnswer: (result: { success: boolean; error?: string }) => void = () => undefined;
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(() => new Promise((resolve) => (mockPromptAnswer = resolve))),
}));
jest.mock('@/features/auth', () => jest.requireActual('@/features/auth/prompt'));
jest.mock('@/features/sen', () => ({
  Sen: ({ pose }: { pose: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`Sen pose ${pose}`}</Text>;
  },
}));

const authenticate = (message: string) =>
  jest
    .requireActual<typeof import('@/features/auth/prompt')>('@/features/auth/prompt')
    .authenticate(message, 'strong');
const goes = (state: AppStateStatus) =>
  act(async () => {
    AppState.currentState = state;
    jest.mocked(AppState.addEventListener).mock.lastCall?.[1](state);
  });
const setOs = (os: string) => Object.defineProperty(Platform, 'OS', { value: os });

beforeEach(() => {
  AppState.currentState = 'active';
  setOs('ios');
});
afterEach(() => setOs('android'));

test.each([
  ['ios', 'active', false, false],
  ['ios', 'inactive', false, true],
  ['ios', 'inactive', true, false],
  ['ios', 'background', false, true],
  ['ios', 'background', true, true],
  ['android', 'inactive', false, false],
  ['android', 'background', false, false],
] as const)('%s, %s, prompting %s: cover %s', (os, state, prompting, expected) => {
  expect(coverShown(os, state, prompting)).toBe(expected);
});

test('on iOS the cover draws when the app goes inactive and clears when it is active again', async () => {
  await render(<PrivacyCover />);
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();

  await goes('inactive');
  expect(screen.getByLabelText('Sen. Content hidden while you switch apps.')).toBeOnTheScreen();
  expect(screen.getByText('RESTING WHILE YOU SWITCH APPS')).toBeOnTheScreen();
  expect(screen.getByText('Sen pose asleep')).toBeOnTheScreen();

  await goes('active');
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});

test('the Face ID sheet does not cover the app', async () => {
  await render(<PrivacyCover />);
  void authenticate('Confirm it is you');

  await goes('inactive');

  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});

test('a prompt cancelled by swiping to the switcher leaves the app inactive, so the cover draws then', async () => {
  await render(<PrivacyCover />);
  void authenticate('Confirm it is you');
  await goes('inactive');
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();

  await act(async () => mockPromptAnswer({ success: false, error: 'system_cancel' }));

  expect(screen.getByTestId('privacy-cover')).toBeOnTheScreen();
});

test('a prompt that ends while the app is active leaves no cover', async () => {
  await render(<PrivacyCover />);
  void authenticate('Confirm it is you');

  await act(async () => mockPromptAnswer({ success: true }));

  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});

test('a state change between the first read and the subscription is not lost', async () => {
  jest.mocked(AppState.addEventListener).mockImplementationOnce(() => {
    AppState.currentState = 'background';
    return { remove: jest.fn() };
  });

  await render(<PrivacyCover />);

  expect(screen.getByTestId('privacy-cover')).toBeOnTheScreen();
});

test('Android draws no cover, because FLAG_SECURE blanks its recents preview', async () => {
  setOs('android');
  await render(<PrivacyCover />);

  await goes('background');

  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});
