import { useEffect } from 'react';
import {
  cancelAnimation,
  type DerivedValue,
  Easing,
  type EasingFunction,
  ReduceMotion,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * The value at `t` of a keyframe track. `eases[i]` shapes the segment from `stops[i]` to
 * `stops[i + 1]`, as a CSS keyframe's timing function does, and a missing one is linear.
 * Outside the stops the track holds its first or last value.
 */
export function kf(
  t: number,
  stops: readonly number[],
  values: readonly number[],
  eases: readonly (EasingFunction | undefined)[] = [],
): number {
  'worklet';
  let t0 = stops[0] ?? 0;
  let v0 = values[0] ?? 0;
  if (t <= t0) return v0;
  for (let i = 1; i < stops.length; i++) {
    const t1 = stops[i] ?? t0;
    const v1 = values[i] ?? v0;
    if (t < t1) {
      const ease = eases[i - 1];
      const p = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (ease ? ease(p) : p);
    }
    t0 = t1;
    v0 = v1;
  }
  return v0;
}

const RUN_MS = 1_000_000_000;

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
