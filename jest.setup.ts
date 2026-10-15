import 'react-native-unistyles/mocks';
import '@/theme/unistyles';
import { setUpTests } from 'react-native-reanimated';

setUpTests();

jest.mock('react-native-svg', () => {
  const svg = jest.requireActual('react-native-reanimated/src/mock-svg');
  return { ...svg, default: svg.Svg };
});
