import type { MMKV } from 'react-native-mmkv';

import type { PrefKey } from '@/models/prefs';

import { clearPrefs, readPref, subscribePrefs, writePref } from './prefs';

let mockStore: MMKV | undefined;
jest.mock('react-native-mmkv', () => {
  const actual = jest.requireActual<typeof import('react-native-mmkv')>('react-native-mmkv');
  return {
    ...actual,
    createMMKV: (config: Parameters<typeof actual.createMMKV>[0]) => {
      mockStore = actual.createMMKV(config);
      return mockStore;
    },
  };
});

beforeEach(() => clearPrefs());

test('the store is the MMKV instance "prefs"', () => {
  expect(mockStore?.id).toBe('prefs');
});

test('a written value reads back', () => {
  writePref('theme', 'dark');
  writePref('idleLock', 10);

  expect([readPref('theme'), readPref('idleLock')]).toEqual([
    'dark',
    10,
  ]);
});

test('a missing, corrupt or out-of-range value reads as the default', () => {
  mockStore?.set('theme', '{not json');
  mockStore?.set('idleLock', JSON.stringify(7));

  expect([readPref('theme'), readPref('idleLock'), readPref('demo.datasetSize')]).toEqual([
    'system',
    5,
    1000,
  ]);
});

test('subscribers hear each write until they unsubscribe', () => {
  const heard: PrefKey[] = [];
  const stop = subscribePrefs((key) => heard.push(key));

  writePref('theme', 'light');
  writePref('demo.next', 'offline');
  stop();
  writePref('theme', 'dark');

  expect(heard).toEqual(['theme', 'demo.next']);
});

test('clearPrefs restores every default and tells subscribers about every key', () => {
  writePref('theme', 'dark');
  writePref('demo.slow', false);
  const heard: PrefKey[] = [];
  const stop = subscribePrefs((key) => heard.push(key));

  clearPrefs();
  stop();

  expect([readPref('theme'), readPref('demo.slow')]).toEqual(['system', true]);
  expect(heard).toEqual([
    'theme',
    'idleLock',
    'relockAfter',
    'senMotion',
    'haptics',
    'demo.next',
    'demo.datasetSize',
    'demo.slow',
    'demo.newOnRefresh',
  ]);
  expect(mockStore?.getAllKeys()).toEqual([]);
});
