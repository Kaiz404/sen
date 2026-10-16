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

// ReducedMotionConfig warns on every mount. Tests mount it on purpose.
const warn = console.warn;
jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  if (String(args[0]).startsWith('[Reanimated] Reduced motion setting is overwritten')) return;
  warn(...args);
});
