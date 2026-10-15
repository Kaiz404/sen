import 'react-native-unistyles/mocks';
import '@/theme/unistyles';
import { setUpTests } from 'react-native-reanimated';

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
