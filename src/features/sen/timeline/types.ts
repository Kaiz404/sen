import type { EaseName, SpringName } from '@/motion/tokens';
import type { HapticEvent } from '@/services/haptics';

import type { Channel } from '../channels';
import type { PoseId } from '../poses';

export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];
export type Ease = EaseName | Bezier;

/**
 * An arrival: the channel reaches `v` at `at` ms, along `ease` from the step before (linear when
 * left out). A track that starts with a step at 0 jumps there. One that doesn't moves from wherever
 * the channel is. A spring step starts at `at` and ends the track.
 */
export type Step =
  | { readonly at: number; readonly v: number; readonly ease?: Ease }
  | { readonly at: number; readonly v: number; readonly spring: SpringName };

/** Never empty, so every track has a value to end on. */
export type Steps = readonly [Step, ...Step[]];

/** At most one track per channel, so two tracks can never fight over a value. */
export type Tracks = Readonly<Partial<Record<Channel, Steps>>>;

export type Mark = { readonly at: number; readonly haptic?: HapticEvent; readonly accents?: true };

export type Priority = 0 | 1 | 2 | 3;

export const MOMENT_IDS = [
  'unlock',
  'reveal',
  'remask',
  'faceScan',
  'authFailed',
  'lockout',
  'lockoutBreathe',
  'lockoutWake',
  'networkError',
  'networkRetry',
  'copy',
  'saved',
  'refreshSpin',
  'refreshSpinLoop',
  'refreshLand',
  'emptySearch',
  'themeLight',
  'themeDark',
  'blink',
  'doubleBlink',
  'glance',
  'lockPeek',
  'slowBlink',
] as const;
export type MomentId = (typeof MOMENT_IDS)[number];

export type Moment = {
  readonly id: MomentId;
  readonly priority: Priority;
  /** The pose the moment starts from. Channels it has no track for ease there as it starts. */
  readonly from: PoseId;
  /** The pose its last frame draws. */
  readonly to: PoseId;
  readonly dur: number;
  readonly tracks: Tracks;
  /** Tracks Calm keeps, such as blinks. Calm turns every other change into a 150 ms crossfade. */
  readonly calm?: readonly Channel[];
  readonly marks: readonly Mark[];
  /** Repeats until a request of the same or higher priority replaces it. */
  readonly loop?: true;
  /** Plays straight after this one on the same Sen. */
  readonly then?: MomentId;
};
