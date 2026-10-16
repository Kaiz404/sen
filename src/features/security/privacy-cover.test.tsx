import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { coverShown, PrivacyCover } from './privacy-cover';

let mockPrompting = false;
jest.mock('@/features/auth', () => ({ isAuthenticating: () => mockPrompting }));

const goes = (state: AppStateStatus) =>
  act(async () => jest.mocked(AppState.addEventListener).mock.lastCall?.[1](state));
const setOs = (os: string) => Object.defineProperty(Platform, 'OS', { value: os });

beforeEach(() => {
  mockPrompting = false;
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

  await goes('active');
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});

test('the Face ID sheet does not cover the app', async () => {
  await render(<PrivacyCover />);
  mockPrompting = true;

  await goes('inactive');

  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});

test('Android draws no cover, because FLAG_SECURE blanks its recents preview', async () => {
  setOs('android');
  await render(<PrivacyCover />);

  await goes('background');

  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});
