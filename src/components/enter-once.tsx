import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { type CSSAnimationKeyframes, type CSSStyle } from 'react-native-reanimated';

import { type MotionLevel, useMotionPolicy } from '@/motion/policy';
import { DUR, EASE_CSS } from '@/motion/tokens';

const SLIDE_IN: CSSAnimationKeyframes<ViewStyle> = {
  from: { opacity: 0, transform: [{ translateY: -24 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

export function enterStyle(level: MotionLevel): CSSStyle<ViewStyle> | null {
  if (level !== 'full') return null;
  return {
    animationName: SLIDE_IN,
    animationDuration: DUR.enter,
    animationTimingFunction: EASE_CSS.out,
    animationFillMode: 'both',
  };
}

/**
 * Slides its children in once, on mount. The caller mounts it only for the one row just added and drops it
 * after `DUR.enter`, so a recycled list cell never replays it.
 */
export function EnterOnce({ children }: { children: ReactNode }): ReactNode {
  return <Animated.View style={enterStyle(useMotionPolicy())}>{children}</Animated.View>;
}
