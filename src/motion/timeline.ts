import { useEffect } from 'react';
import {
  cancelAnimation,
  type DerivedValue,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Piecewise-linear keyframes, clamped at both ends. A worklet.
 * `kf(t, [0, 400, 900], [0, -80, 0])` is -40 at t = 200 and 0 at t = 2000.
 */
export function kf(t: number, stops: readonly number[], values: readonly number[]): number {
  'worklet';
  return interpolate(t, stops, values, Extrapolation.CLAMP);
}

/** Long enough that a loop never reaches the end of its run. */
const RUN_MS = 1_000_000_000;

/**
 * A UI-thread clock that runs from 0 to `periodMs` linearly and wraps, while `running`. Launch derives its
 * letters, drop and fade from one clock through `kf`, so it renders zero times while it loops.
 * When `running` turns false the clock holds its value, and it resumes from there. The caller decides
 * `running` from the motion level, so the clock itself ignores Reduce Motion.
 * It is read-only. Under it, one linear run counts elapsed time, so laps never lose a frame at the wrap.
 */
export function useLoopClock(periodMs: number, running = true): DerivedValue<number> {
  const elapsed = useSharedValue(0);

  useEffect(() => {
    if (!running) return;
    const from = elapsed.get();
    elapsed.set(
      withTiming(from + RUN_MS, {
        duration: RUN_MS,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
    );
    return () => cancelAnimation(elapsed);
  }, [elapsed, running]);

  return useDerivedValue(() => elapsed.get() % periodMs);
}
