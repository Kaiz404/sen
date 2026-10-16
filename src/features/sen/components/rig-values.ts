import {
  cancelAnimation,
  makeMutable,
  ReduceMotion,
  type SharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { MotionLevel } from '@/motion/policy';
import { DUR, SPRING } from '@/motion/tokens';

import { type Channel, CHANNEL_KIND, CHANNELS, type Frame } from '../channels';

/** One shared value per channel. A value costs nothing while it is still. */
export type RigValues = Readonly<Record<Channel, SharedValue<number>>>;

export function makeRig(frame: Frame): RigValues {
  return Object.fromEntries(
    CHANNELS.map((ch): [Channel, SharedValue<number>] => [ch, makeMutable(frame[ch])]),
  ) as Record<Channel, SharedValue<number>>;
}

/** Only the channels a node reads, so its mapper wakes for those alone. */
export function pick(
  rig: RigValues,
  channels: readonly Channel[],
): Readonly<Record<string, SharedValue<number>>> {
  return Object.fromEntries(channels.map((ch) => [ch, rig[ch]]));
}

const TURN = 2 * Math.PI;

/**
 * Brings the spin angle back to the nearest heads-up turn, (−π, π]. It draws the same coin, so a
 * spin that was cut off settles the short way.
 */
export function unwind(rig: RigValues): void {
  const th = rig['sp.th'];
  const a = ((th.get() % TURN) + TURN) % TURN;
  th.set(a > Math.PI ? a - TURN : a);
}

/** Brings the spin angle into [0, 2π), the same drawing, so a moment that turns it goes forward. */
export function wrap(rig: RigValues): void {
  const th = rig['sp.th'];
  th.set(((th.get() % TURN) + TURN) % TURN);
}

export function stop(rig: RigValues): void {
  for (const ch of CHANNELS) cancelAnimation(rig[ch]);
}

const NEVER = ReduceMotion.Never;

/** Eases one channel to a value: opacities fade, everything else springs. Calm fades in 150 ms. */
export function ease(sv: SharedValue<number>, ch: Channel, v: number, level: MotionLevel): void {
  if (sv.get() === v) return;
  if (level === 'off') sv.set(v);
  else if (level === 'calm') sv.set(withTiming(v, { duration: DUR.calm, reduceMotion: NEVER }));
  else if (CHANNEL_KIND[ch] === 'fade')
    sv.set(withTiming(v, { duration: DUR.crossfade, reduceMotion: NEVER }));
  else sv.set(withSpring(v, { ...SPRING.settle, reduceMotion: NEVER }));
}

/** Eases every channel to a frame, as a pose change with no moment does. */
export function settle(rig: RigValues, frame: Frame, level: MotionLevel): void {
  stop(rig);
  unwind(rig);
  for (const ch of CHANNELS) ease(rig[ch], ch, frame[ch], level);
}

/** Sets every channel at once. Used where the drawing doesn't change, such as a moment's last frame. */
export function snap(rig: RigValues, frame: Frame): void {
  stop(rig);
  for (const ch of CHANNELS) rig[ch].set(frame[ch]);
}
