import type { ComponentClass } from 'react';
import Animated from 'react-native-reanimated';
import { G, type GProps } from 'react-native-svg';

import type { Matrix } from '../art/matrix';

/** RNSVG's native G takes `matrix`, but its JS props type leaves it out. */
export const AnimatedG = Animated.createAnimatedComponent(
  G as unknown as ComponentClass<GProps & { matrix?: Matrix }>,
);
