import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { playHaptic } from './haptics';
import { logEvent } from './logger';
import { clearPrefs, writePref } from './prefs';

jest.mock('./logger');
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  performAndroidHapticsAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

const calls = () => ({
  android: jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls,
  notification: jest.mocked(Haptics.notificationAsync).mock.calls,
  impact: jest.mocked(Haptics.impactAsync).mock.calls,
  selection: jest.mocked(Haptics.selectionAsync).mock.calls,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearPrefs();
});

test('on Android each moment plays its named haptic', () => {
  playHaptic('unlock');
  playHaptic('authFailed');
  playHaptic('launch');
  playHaptic('copy');
  playHaptic('hideNow');
  playHaptic('segment');

  expect(calls().android).toEqual([
    ['confirm'],
    ['reject'],
    ['context-click'],
    ['context-click'],
    ['toggle-off'],
    ['segment-tick'],
  ]);
});

test('on iOS the same moments use expo-haptics feedback types', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');

  playHaptic('unlock');
  playHaptic('networkError');
  playHaptic('launch');
  playHaptic('refreshLanded');
  playHaptic('refreshThreshold');

  expect(calls()).toEqual({
    android: [],
    notification: [['success'], ['warning']],
    impact: [['light'], ['light']],
    selection: [[]],
  });
  jest.restoreAllMocks();
});

test('with the Haptics setting off, nothing plays', () => {
  writePref('haptics', false);
  playHaptic('unlock');
  writePref('haptics', true);
  playHaptic('saved');

  expect(calls().android).toEqual([['confirm']]);
});

test('a device that cannot buzz logs a code and does not throw', async () => {
  jest.mocked(Haptics.performAndroidHapticsAsync).mockRejectedValueOnce(new Error('no vibrator'));

  playHaptic('lockout');
  await Promise.resolve();
  await Promise.resolve();

  expect(jest.mocked(logEvent).mock.calls).toEqual([['haptics.failed']]);
});
