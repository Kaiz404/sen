import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import type * as Prefs from '@/services/prefs';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';

import { SettingsScreen } from './settings-screen';
import './theme';

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => ({}),
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
}));

/**
 * Unistyles' runtime as its native code behaves (HybridUnistylesRuntime.cpp, 3.5.3): adaptive themes follow the
 * phone's scheme, and `setTheme` throws while they are on.
 */
const phone = { scheme: 'light' as 'light' | 'dark' };
const live = { adaptive: true, theme: 'light' };

beforeEach(() => {
  phone.scheme = 'light';
  Object.assign(live, { adaptive: true, theme: 'light' });
  jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes').mockImplementation((on) => {
    live.adaptive = on;
    if (on) live.theme = phone.scheme;
  });
  jest.spyOn(UnistylesRuntime, 'setTheme').mockImplementation((name) => {
    if (live.adaptive) throw new Error(`setTheme('${name}') while adaptiveThemes are enabled`);
    live.theme = name;
  });
  clearPrefs();
});
afterEach(() => jest.restoreAllMocks());

const renderSettings = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsScreen />
    </QueryClientProvider>,
  );

const choose = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));
const checked = (name: string) =>
  screen.getByRole('radio', { name }).props.accessibilityState.checked as boolean;

test('choosing Dark switches the live theme at once and saves the choice', async () => {
  await renderSettings();

  await choose('Dark');

  expect(live).toEqual({ adaptive: false, theme: 'dark' });
  expect(checked('Dark')).toBe(true);
  expect(readPref('theme')).toBe('dark');
});

test('System follows the phone, light or dark, and Light holds against a dark phone', async () => {
  await renderSettings();
  phone.scheme = 'dark';

  await choose('Light');
  const light = { ...live };
  await choose('System');
  const dark = { ...live };
  phone.scheme = 'light';
  await choose('Dark');
  await choose('System');

  expect([light, dark, live]).toEqual([
    { adaptive: false, theme: 'light' },
    { adaptive: true, theme: 'dark' },
    { adaptive: true, theme: 'light' },
  ]);
});

test('sign out clears the choice, and the live theme follows the phone again', async () => {
  phone.scheme = 'dark';
  writePref('theme', 'light');

  clearPrefs();

  expect(live).toEqual({ adaptive: true, theme: 'dark' });
});

test.each([
  ['dark', { initialTheme: 'dark' }],
  ['light', { initialTheme: 'light' }],
  ['system', { adaptiveThemes: true }],
] as const)(
  'a saved "%s" is in the theme settings before the first screen loads',
  (saved, settings) => {
    const configure = jest.spyOn(StyleSheet, 'configure');

    jest.isolateModules(() => {
      jest.requireActual<typeof Prefs>('@/services/prefs').writePref('theme', saved);
      jest.requireActual('./theme');
    });

    expect(configure).toHaveBeenCalledWith({ themes: expect.any(Object), settings });
  },
);
