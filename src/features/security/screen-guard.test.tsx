import ExpoScreenCapture from 'expo-screen-capture/build/ExpoScreenCapture';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { logEvent } from '@/services/logger';

import { guardsScreens, useScreenGuard } from './screen-guard';

jest.mock('expo-screen-capture/build/ExpoScreenCapture', () => ({
  __esModule: true,
  default: {
    preventScreenCapture: jest.fn(async () => undefined),
    allowScreenCapture: jest.fn(async () => undefined),
  },
}));
jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));

const native = jest.mocked(ExpoScreenCapture);
const prevent = native.preventScreenCapture;
const allow = native.allowScreenCapture;
const setDev = (on: boolean) => Object.assign(globalThis, { __DEV__: on });
const foreground = async () => {
  const listener = jest.mocked(AppState.addEventListener).mock.lastCall?.[1];
  await act(async () => listener?.('active'));
};

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

  expect(prevent).toHaveBeenCalledTimes(1);
  await unmount();
  expect(allow).toHaveBeenCalledTimes(1);
});

test('a dev build leaves capture open so agents can screenshot it', async () => {
  await renderHook(() => useScreenGuard());

  expect(prevent).not.toHaveBeenCalled();
});

test('returning to the foreground after a successful block does not call the native module again', async () => {
  setDev(false);
  await renderHook(() => useScreenGuard());
  await act(async () => undefined);

  await foreground();

  expect(prevent).toHaveBeenCalledTimes(1);
});

test('returning to the foreground after a native failure retries the block', async () => {
  setDev(false);
  prevent.mockRejectedValueOnce(new Error('no key window'));
  await renderHook(() => useScreenGuard());
  await act(async () => undefined);
  expect(logEvent).toHaveBeenCalledWith('guard.failed');
  expect(prevent).toHaveBeenCalledTimes(1);

  await foreground();

  expect(prevent).toHaveBeenCalledTimes(2);
  expect(logEvent).toHaveBeenCalledTimes(1);
});

test('a native failure is logged and does not throw', async () => {
  setDev(false);
  prevent.mockRejectedValueOnce(new Error('no key window'));
  await renderHook(() => useScreenGuard());
  await act(async () => undefined);

  expect(logEvent).toHaveBeenCalledWith('guard.failed');
});
