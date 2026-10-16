import {
  Easing,
  ReduceMotion,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { MotionLevel } from '@/motion/policy';
import { DUR, EASE, SPRING } from '@/motion/tokens';

import { type Channel, CHANNELS, type Frame } from '../channels';
import type { Ease, Mark, Moment, Steps } from './types';

/**
 * The director picks the form for the motion level, so Reanimated must never shorten a step itself.
 * Under `ReduceMotion.System` a Calm crossfade would jump to its end.
 */
const NEVER = ReduceMotion.Never;

/** How long an interrupted channel takes to reach a moment's first value instead of jumping. */
export const ENTRY_MS = 80;

function easing(e: Ease | undefined) {
  if (e === undefined) return Easing.linear;
  return typeof e === 'string' ? EASE[e] : Easing.bezier(...e);
}

/**
 * A track that opens with a jump at 0 assumes the channel rests where the moment starts. When a
 * moment cuts in on another, the channel is elsewhere, so the jump becomes a short ease. Later steps
 * keep their times. A lone jump is a snap on purpose, as in Off, and stays one.
 */
export function entry(steps: Steps, current: number): Steps {
  const [first, ...rest] = steps;
  if (rest.length === 0 || first.at !== 0 || 'spring' in first) return steps;
  if (Math.abs(first.v - current) < 1e-3) return steps;
  const blend = Math.min(ENTRY_MS, rest[0]?.at ?? ENTRY_MS);
  return blend === 0 ? steps : [{ at: blend, v: first.v, ease: 'out' }, ...rest];
}

/** One track as a Reanimated animation. Each step runs from the step before it, starting at 0 ms. */
export function compileTrack(steps: Steps, dur: number, loop = false): number {
  let t = 0;
  const parts = steps.map((s) => {
    const gap = Math.max(0, s.at - t);
    t = s.at;
    return 'spring' in s
      ? withDelay(gap, withSpring(s.v, { ...SPRING[s.spring], reduceMotion: NEVER }))
      : withTiming(s.v, { duration: gap, easing: easing(s.ease), reduceMotion: NEVER });
  });
  const end = steps[steps.length - 1]!;
  if (loop && t < dur) parts.push(withTiming(end.v, { duration: dur - t, reduceMotion: NEVER }));
  const seq = parts.length === 1 ? parts[0]! : withSequence(NEVER, ...parts);
  return loop ? withRepeat(seq, -1, false, undefined, NEVER) : seq;
}

const lastAt = (steps: Steps) => steps[steps.length - 1]!.at;

/**
 * The moment as the motion level plays it. Full plays it as drawn. Calm keeps only the tracks the
 * moment marks as calm (blinks) and turns every other change between its poses into a 150 ms
 * crossfade. Off snaps to the end pose. Both keep the haptics and drop the accents.
 */
export function formFor(m: Moment, level: MotionLevel, from: Frame, to: Frame): Moment {
  if (level === 'full') return m;
  const ms = level === 'calm' ? DUR.calm : 0;
  const kept: Partial<Record<Channel, Steps>> = {};
  if (level === 'calm') for (const ch of m.calm ?? []) if (m.tracks[ch]) kept[ch] = m.tracks[ch];
  const tracks: Partial<Record<Channel, Steps>> = { ...kept };
  for (const ch of CHANNELS) {
    if (!(ch in kept) && from[ch] !== to[ch]) tracks[ch] = [{ at: ms, v: to[ch] }];
  }
  const marks: Mark[] = m.marks.flatMap((mk) =>
    mk.haptic ? [{ at: mk.at, haptic: mk.haptic }] : [],
  );
  const dur = Math.max(ms, ...Object.values(kept).map(lastAt), ...marks.map((mk) => mk.at));
  const { loop: _loop, ...rest } = m;
  return { ...rest, tracks, marks, dur };
}

