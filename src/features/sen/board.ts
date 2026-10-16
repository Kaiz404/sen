import { Easing, type EasingFunction } from 'react-native-reanimated';

import { EASE_FN } from '@/motion/tokens';

import { type Channel, CHANNELS } from './channels';
import type { Ease, Step, Steps, Tracks } from './timeline/types';

export type BoardStep = readonly [at: number, v: number, ease?: Ease];
export type BoardData = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, readonly BoardStep[]>>>>>
>;

const IS_CHANNEL: ReadonlySet<string> = new Set(CHANNELS);

type Window = { readonly from?: number; readonly to: number };

/**
 * The steps of one board track between `from` and `to`, rebased so `from` is 0. The board loops, so
 * a moment is the stretch that starts at its first pose and ends where the next pose holds.
 */
export function slice(steps: readonly BoardStep[], { from = 0, to }: Window): Step[] {
  const inside = steps.filter(([at]) => at >= from && at <= to);
  const before = steps.filter(([at]) => at < from).at(-1);
  const head = inside[0];
  const lead: BoardStep[] = before && (!head || head[0] > from) ? [[from, before[1]]] : [];
  return [...lead, ...inside].map(([at, v, ease]) =>
    ease === undefined ? { at: at - from, v } : { at: at - from, v, ease },
  );
}

/**
 * Every rig channel a board moment sets in the window. A track that never changes becomes one step
 * at 0, because its value can still differ from the pose the moment starts in.
 */
export function boardTracks(moment: Readonly<Record<string, readonly BoardStep[]>>, w: Window): Tracks {
  const out: Partial<Record<Channel, Steps>> = {};
  for (const [key, steps] of Object.entries(moment)) {
    if (!IS_CHANNEL.has(key)) continue;
    const [head, ...rest] = slice(steps, w);
    if (!head) continue;
    out[key as Channel] = rest.some((step) => step.v !== head.v) ? [head, ...rest] : [{ at: 0, v: head.v }];
  }
  return out;
}

/** A board track as `kf` reads it: `eases[i]` shapes the segment that starts at `stops[i]`. */
export type Keyframes = {
  readonly stops: readonly number[];
  readonly values: readonly number[];
  readonly eases: readonly EasingFunction[];
};

function curve(e: Ease | undefined): EasingFunction {
  if (e === undefined) return EASE_FN.linear;
  return typeof e === 'string' ? EASE_FN[e] : Easing.bezierFn(...e);
}

/** A board track from `lead` ms on, rebased to 0, for a component that reads one clock with `kf`. */
export function keyframesOf(steps: readonly BoardStep[], lead = 0): Keyframes {
  const kept = steps.filter(([at]) => at >= lead);
  return {
    stops: kept.map(([at]) => at - lead),
    values: kept.map(([, v]) => v),
    eases: kept.slice(1).map(([, , e]) => curve(e)),
  };
}
