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

export function kf(t: number, stops: readonly number[], values: readonly number[]): number {
  'worklet';
  return interpolate(t, stops, values, Extrapolation.CLAMP);
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
