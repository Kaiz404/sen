import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const ENDING_MS = 10_000;

function secondsUntil(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function useSecondsLeft(deadline: number | null): number {
  const [left, setLeft] = useState(() => secondsUntil(deadline, Date.now()));

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = Date.now();
      setLeft(secondsUntil(deadline, now));
      if (deadline !== null && deadline > now)
        id = setTimeout(tick, (deadline - now) % 1000 || 1000);
    };
    tick();
    return () => clearTimeout(id);
  }, [deadline]);

  return left;
}

export function useCountdownProgress(deadline: number, totalMs: number): SharedValue<number> {
  const progress = useSharedValue(1);

  useEffect(() => {
    const seed = () => {
      const remaining = Math.min(totalMs, Math.max(0, deadline - Date.now()));
      progress.set(remaining / totalMs);
      progress.set(
        withTiming(0, {
          duration: remaining,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
      );
    };
    seed();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') seed();
    });
    return () => {
      sub.remove();
      cancelAnimation(progress);
    };
  }, [deadline, totalMs, progress]);

  return progress;
}

export function ringOffset(p: number, c: number): number {
  'worklet';
  return c * (1 - p);
}

export function useRevealPhase(deadline: number | null): 'revealed' | 'ending' {
  const [endingFor, setEndingFor] = useState(() =>
    deadline !== null && deadline - ENDING_MS <= Date.now() ? deadline : null,
  );

  useEffect(() => {
    if (deadline === null) return;
    const wait = Math.max(0, deadline - ENDING_MS - Date.now());
    const id = setTimeout(() => setEndingFor(deadline), wait);
    return () => clearTimeout(id);
  }, [deadline]);

  return deadline !== null && endingFor === deadline ? 'ending' : 'revealed';
}
