import { Platform } from 'react-native';
import 'react-native-unistyles/mocks';
import { setUpTests } from 'react-native-reanimated';

import { configureThemes } from '@/theme/unistyles';

// The app entry configures from the saved pref. Tests start on System and leave MMKV untouched, so a test file can
// still mock it. theme.test.tsx loads the real boot module.
configureThemes('system');

// The stock mock never switches theme. Here `setTheme` and `setAdaptiveThemes` (System follows a light phone) move a
// live theme that `useUnistyles` re-renders on, as on the device. `StyleSheet.create` still resolves once on the
// light theme, so a colour that only a stylesheet carries stays light after a switch, the way text inside an
// animated view did on the phone (ARCHITECTURE › Colours).
{
  const React = jest.requireActual<typeof import('react')>('react');
  const unistyles = jest.requireMock<Record<string, any>>('react-native-unistyles');
  const runtime = unistyles.UnistylesRuntime;
  const themes = (
    globalThis as { __UNISTYLES_MOCK_REGISTRY__?: { themes: Record<string, object> } }
  ).__UNISTYLES_MOCK_REGISTRY__!.themes;
  const listeners = new Set<() => void>();
  let live = 'light';
  const set = (name: string) => {
    if (name === live) return;
    live = name;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  runtime.setTheme = (name: string) => set(name);
  runtime.setAdaptiveThemes = (on: boolean) => {
    if (on) set('light');
  };
  runtime.getTheme = () => themes[live];
  Object.defineProperty(runtime, 'themeName', { get: () => live, configurable: true });
  function useUnistyles() {
    const name = React.useSyncExternalStore(subscribe, () => live);
    return { theme: themes[name], rt: runtime };
  }
  unistyles.useUnistyles = useUnistyles;
  beforeEach(() => set('light'));
}

// jest-expo leaves the Android API level undefined. Tests run on a current phone, and the ones that care pick their own.
Object.defineProperty(Platform, 'Version', { get: () => 36, configurable: true });
setUpTests();

jest.mock('react-native-svg', () => {
  const svg = jest.requireActual('react-native-reanimated/src/mock-svg');
  return { ...svg, default: svg.Svg };
});

// The date picker is a native view and a native module that jest cannot load. Tests read what the app asked the
// Android dialog to open with from `DateTimePickerAndroid.open`.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn(() => Promise.resolve(true)) },
}));

// ReducedMotionConfig warns on every mount. Tests mount it on purpose.
const warn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  if (String(args[0]).startsWith('[Reanimated] Reduced motion setting is overwritten')) return;
  warn(...args);
});
