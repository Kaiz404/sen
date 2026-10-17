import 'react-native-unistyles/mocks';
import { setUpTests } from 'react-native-reanimated';

import { configureThemes } from '@/theme/unistyles';

// The app entry configures from the saved pref. Tests start on System and leave MMKV untouched, so a test file can
// still mock it. theme.test.tsx loads the real boot module.
configureThemes('system');
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
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// ReducedMotionConfig warns on every mount. Tests mount it on purpose.
const warn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  if (String(args[0]).startsWith('[Reanimated] Reduced motion setting is overwritten')) return;
  warn(...args);
});
