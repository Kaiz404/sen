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
  malSpring: [0.34, 1.56, 0.64, 1],
  handoff: [0.3, 1.25, 0.5, 1],
  hopOut: [0.2, 0.7, 0.4, 1],
  hopIn: [0.6, 0, 0.8, 0.3],
} as const satisfies Record<string, readonly [number, number, number, number]>;

type BezierName = keyof typeof BEZIER;
export type EaseName = BezierName | 'linear';
type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

function perBezier<T>(make: (b: Bezier) => T): Record<BezierName, T> {
  return Object.fromEntries(
    Object.entries(BEZIER).map(([name, b]) => [name, make(b)]),
  ) as Record<BezierName, T>;
}

export const EASE: Readonly<Record<EaseName, EasingFunction | EasingFunctionFactory>> = {
  ...perBezier((b) => Easing.bezier(...b)),
  linear: Easing.linear,
};

export const EASE_FN: Readonly<Record<EaseName, EasingFunction>> = {
  ...perBezier((b) => Easing.bezierFn(...b)),
  linear: Easing.linear,
};

export const EASE_CSS: Readonly<Record<EaseName, CSSTransitionTimingFunction>> = {
  ...perBezier((b) => cubicBezier(...b)),
  linear: 'linear',
};

export const SPRING = {
  pop: { damping: 14, stiffness: 260, mass: 0.7 },
  settle: { damping: 18, stiffness: 220, mass: 0.8 },
  soft: { damping: 20, stiffness: 140, mass: 1 },
  launch: { damping: 12, stiffness: 180, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof SPRING;

export const DUR = {
  press: 90,
  crossfade: 120,
  calm: 150,
  enter: 900,
  bone: 1400,
  launchLoop: 4200,
} as const;
