import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { logEvent } from '@/services/logger';

import { guardsScreens, useScreenGuard } from './screen-guard';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));
jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));

const prevent = jest.mocked(preventScreenCaptureAsync);
const allow = jest.mocked(allowScreenCaptureAsync);
const setDev = (on: boolean) => Object.assign(globalThis, { __DEV__: on });

beforeEach(() => jest.clearAllMocks());
afterEach(() => setDev(true));

test('a release build always guards, and a dev build never does', () => {
  setDev(false);
  expect(guardsScreens()).toBe(true);
  setDev(true);
  expect(guardsScreens()).toBe(false);
});

test('a release build blocks capture on mount and lifts it on unmount', async () => {
  setDev(false);
  const { unmount } = await renderHook(() => useScreenGuard());

  expect(prevent.mock.calls).toEqual([['sen-screen-guard']]);
  await unmount();
  expect(allow.mock.calls).toEqual([['sen-screen-guard']]);
});

test('a dev build leaves capture open so agents can screenshot it', async () => {
  await renderHook(() => useScreenGuard());

  expect(prevent).not.toHaveBeenCalled();
});

test('a release build blocks capture again each time the app returns to the foreground', async () => {
  setDev(false);
  await renderHook(() => useScreenGuard());
  const listener = jest.mocked(AppState.addEventListener).mock.lastCall?.[1];

  await act(async () => listener?.('background'));
  expect(prevent).toHaveBeenCalledTimes(1);
  await act(async () => listener?.('active'));
  expect(prevent).toHaveBeenCalledTimes(2);
});

test('a native failure is logged and does not throw', async () => {
  setDev(false);
  prevent.mockRejectedValueOnce(new Error('no key window'));
  await renderHook(() => useScreenGuard());
  await act(async () => undefined);

  expect(logEvent).toHaveBeenCalledWith('guard.failed');
});
