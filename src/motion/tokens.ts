import {
  cubicBezier,
  Easing,
  type CSSTransitionTimingFunction,
  type EasingFunction,
  type EasingFunctionFactory,
  type WithSpringConfig,
} from 'react-native-reanimated';

export const BEZIER = {
  out: [0.2, 0.8, 0.2, 1],
  sine: [0.37, 0, 0.63, 1],
  inQ: [0.55, 0.085, 0.68, 0.53],
  outQ: [0.25, 0.46, 0.45, 0.94],
  inS: [0.12, 0, 0.39, 0],
  outS: [0.61, 1, 0.88, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EaseName = keyof typeof BEZIER | 'linear';

export const EASE: Readonly<Record<EaseName, EasingFunction | EasingFunctionFactory>> = {
  out: Easing.bezier(...BEZIER.out),
  sine: Easing.bezier(...BEZIER.sine),
  inQ: Easing.bezier(...BEZIER.inQ),
  outQ: Easing.bezier(...BEZIER.outQ),
  inS: Easing.bezier(...BEZIER.inS),
  outS: Easing.bezier(...BEZIER.outS),
  linear: Easing.linear,
};

export const EASE_CSS: Readonly<Record<EaseName, CSSTransitionTimingFunction>> = {
  out: cubicBezier(...BEZIER.out),
  sine: cubicBezier(...BEZIER.sine),
  inQ: cubicBezier(...BEZIER.inQ),
  outQ: cubicBezier(...BEZIER.outQ),
  inS: cubicBezier(...BEZIER.inS),
  outS: cubicBezier(...BEZIER.outS),
  linear: 'linear',
};

export const SPRING = {
  pop: { damping: 14, stiffness: 260, mass: 0.7 },
  settle: { damping: 18, stiffness: 220, mass: 0.8 },
  soft: { damping: 20, stiffness: 140, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof SPRING;

export const DUR = {
  press: 90,
  crossfade: 120,
  calm: 150,
  enter: 900,
  bone: 1400,
  launchLoop: 4800,
} as const;
