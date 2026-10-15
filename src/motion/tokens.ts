import {
  cubicBezier,
  Easing,
  type CSSTransitionTimingFunction,
  type EasingFunction,
  type EasingFunctionFactory,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * The canvas curves, as control points. The one source for both the worklet easings and the CSS ports,
 * so a board keyframe and an app step draw the same curve. Values from the MAX boards' `cubic-bezier(...)`.
 */
export const BEZIER = {
  /** Arrivals, eye moves. */
  out: [0.2, 0.8, 0.2, 1],
  /** Holds, returns. */
  sine: [0.37, 0, 0.63, 1],
  /** Falls, exits. */
  inQ: [0.55, 0.085, 0.68, 0.53],
  /** Rises. */
  outQ: [0.25, 0.46, 0.45, 0.94],
  /** Spin toward edge-on. */
  inS: [0.12, 0, 0.39, 0],
  /** Spin away from edge-on. */
  outS: [0.61, 1, 0.88, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EaseName = keyof typeof BEZIER | 'linear';

/** For `withTiming({ easing })` and Sen's moment steps, which name an `EaseName`. */
export const EASE: Readonly<Record<EaseName, EasingFunction | EasingFunctionFactory>> = {
  out: Easing.bezier(...BEZIER.out),
  sine: Easing.bezier(...BEZIER.sine),
  inQ: Easing.bezier(...BEZIER.inQ),
  outQ: Easing.bezier(...BEZIER.outQ),
  inS: Easing.bezier(...BEZIER.inS),
  outS: Easing.bezier(...BEZIER.outS),
  linear: Easing.linear,
};

/** For Reanimated CSS transitions and keyframes (key press, segmented pill, EnterOnce, Bone). */
export const EASE_CSS: Readonly<Record<EaseName, CSSTransitionTimingFunction>> = {
  out: cubicBezier(...BEZIER.out),
  sine: cubicBezier(...BEZIER.sine),
  inQ: cubicBezier(...BEZIER.inQ),
  outQ: cubicBezier(...BEZIER.outQ),
  inS: cubicBezier(...BEZIER.inS),
  outS: cubicBezier(...BEZIER.outS),
  linear: 'linear',
};

/** DESIGN.md › Rig for Reanimated. One clean overshoot each. No `reduceMotion` here: policy owns that. */
export const SPRING = {
  /** About 15% overshoot. */
  pop: { damping: 14, stiffness: 260, mass: 0.7 },
  /** About 5%. */
  settle: { damping: 18, stiffness: 220, mass: 0.8 },
  /** No visible overshoot. */
  soft: { damping: 20, stiffness: 140, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof SPRING;

/** Durations in ms that more than one lane uses. A moment's own beats live in its data, not here. */
export const DUR = {
  /** Key face drop onto its shadow plate. */
  press: 90,
  /** Opacity channels: eye state, mouth, cheeks, props. */
  crossfade: 120,
  /** Every pose change in Calm, marked ReduceMotion.Never. */
  calm: 150,
  /** New row slide-in. */
  enter: 900,
  /** Skeleton band period. */
  bone: 1400,
  /** Launch loop period. */
  launchLoop: 4800,
} as const;
