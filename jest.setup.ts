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

// Tests run on a phone with a 48 pt status bar and a 34 pt gesture bar. On the device Unistyles keeps an inset live
// only through a `style` prop or `withUnistyles`. A plain ScrollView's `contentContainerStyle` keeps what the sheet
// held at bundle start, before the window reported its insets (ARCHITECTURE › Layout and insets). Here every sheet
// resolves with the phone's insets, and a plain ScrollView swaps its content style for the bundle-start copy.
{
  const React = jest.requireActual<typeof import('react')>('react');
  const unistyles = jest.requireMock<Record<string, any>>('react-native-unistyles');
  const insets = { top: 48, bottom: 34, left: 0, right: 0, ime: 0 };
  const AT_START = Symbol('style at bundle start');
  const tag = (live: unknown, atStart: unknown) =>
    live !== null && typeof live === 'object'
      ? Object.defineProperty({ ...live }, AT_START, { value: atStart })
      : live;
  const create = unistyles.StyleSheet.create;
  unistyles.UnistylesRuntime.insets = insets;
  unistyles.StyleSheet.create = (sheet: unknown) => {
    if (typeof sheet !== 'function') return create(sheet);
    const atStart = create(sheet);
    // Resolved again when a test moves the insets (`setInsets` in src/theme/testing.ts), as the device does.
    let seen = '';
    let live: Record<string, any> = {};
    const current = () => {
      const now = JSON.stringify(unistyles.UnistylesRuntime.insets);
      if (now !== seen) {
        seen = now;
        live = create((theme: object, rt: object) =>
          sheet(theme, { ...rt, insets: { ...unistyles.UnistylesRuntime.insets } }),
        );
      }
      return live;
    };
    return Object.defineProperties(
      {},
      Object.fromEntries(
        Object.keys(atStart).map((key) => [
          key,
          {
            enumerable: true,
            get: () => {
              const value = current()[key];
              return typeof value === 'function'
                ? (...args: unknown[]) => tag(value(...args), atStart[key](...args))
                : tag(value, atStart[key]);
            },
          },
        ]),
      ),
    );
  };
  beforeEach(() => {
    unistyles.UnistylesRuntime.insets = insets;
  });

  type Style = unknown;
  const pick = (style: Style, frozen: boolean): Style => {
    if (Array.isArray(style)) return style.map((s) => pick(s, frozen));
    if (style === null || typeof style !== 'object') return style;
    return frozen ? ((style as Record<symbol, Style>)[AT_START] ?? style) : { ...style };
  };
  const rn = jest.requireActual<Record<string, any>>('react-native');
  class PlainScroll extends rn.ScrollView {
    render() {
      const props = (this as unknown as { props: { contentContainerStyle?: Style } }).props;
      return React.cloneElement(super.render(), {
        contentContainerStyle: pick(props.contentContainerStyle, true),
      });
    }
  }
  Object.defineProperty(rn, 'ScrollView', { get: () => PlainScroll, configurable: true });
  unistyles.withUnistyles =
    (Component: React.ComponentType<object>) =>
    ({ style, contentContainerStyle, ...props }: { style?: Style; contentContainerStyle?: Style }) =>
      React.createElement(Component, {
        ...props,
        ...(style === undefined ? {} : { style: pick(style, false) }),
        ...(contentContainerStyle === undefined
          ? {}
          : { contentContainerStyle: pick(contentContainerStyle, false) }),
      });
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
