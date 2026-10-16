import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { AddLayout } from './add-layout';

jest.mock('expo-router', () => ({ Stack: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b' }));

const goes = (state: AppStateStatus) =>
  act(async () => {
    AppState.currentState = state;
    jest.mocked(AppState.addEventListener).mock.calls.forEach(([, listener]) => listener(state));
  });

beforeEach(() => {
  AppState.currentState = 'active';
  Object.defineProperty(Platform, 'OS', { value: 'ios' });
});
afterEach(() => Object.defineProperty(Platform, 'OS', { value: 'android' }));

test('on iOS the add flow, which sits above the root cover, draws its own cover while inactive', async () => {
  await render(<AddLayout />);
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();

  await goes('inactive');
  expect(screen.getByLabelText('Sen. Content hidden while you switch apps.')).toBeOnTheScreen();

  await goes('active');
  expect(screen.queryByTestId('privacy-cover')).not.toBeOnTheScreen();
});
