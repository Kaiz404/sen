import type { EasingFunction } from 'react-native-reanimated';

import { EASE_FN } from '@/motion/tokens';

import type { BoardStep } from '../board';
import { BOARDS } from '../board.gen';
import type { Ease } from '../timeline/types';

/** One accent value as `kf` reads it: `eases[i]` shapes the segment that starts at `stops[i]`. */
export type Keyframes = {
  readonly stops: readonly number[];
  readonly values: readonly number[];
  readonly eases: readonly EasingFunction[];
};

const FX: Readonly<Record<string, readonly BoardStep[]>> = BOARDS['MAX-Library']['.L-fx'];

/** The swoosh starts drawing 160 ms into `.L-fx`. Every app moment starts its accents there. */
const LEAD = 160;

function curve(e: Ease | undefined): EasingFunction {
  if (e === undefined) return EASE_FN.linear;
  return typeof e === 'string' ? EASE_FN[e] : EASE_FN.linear;
}

function keyframes(key: string): Keyframes {
  const steps = FX[key]!.filter(([at]) => at >= LEAD);
  return {
    stops: steps.map(([at]) => at - LEAD),
    values: steps.map(([, v]) => v),
    eases: steps.slice(1).map(([, , e]) => curve(e)),
  };
}

const star = (n: 1 | 2 | 3) => ({
  op: keyframes(`s${n}.op`),
  s: keyframes(`s${n}.s`),
  r: keyframes(`s${n}.r`),
});
const tick = (n: 1 | 2 | 3) => ({
  op: keyframes(`t${n}.op`),
  s: keyframes(`t${n}.s`),
  x: keyframes(`t${n}.x`),
  y: keyframes(`t${n}.y`),
});

/** MAX-Library accent-pop (`.L-fx`): stars pop 0.2 › 1.18 › 1 and spin in, ticks fly out, the swoosh draws on. */
export const ACCENT = {
  stars: [star(1), star(2), star(3)],
  ticks: [tick(1), tick(2), tick(3)],
  swoosh: { op: keyframes('sw.op'), off: keyframes('sw.off') },
} as const;

/** When the last accent has faded: the tile's last change on a star, tick or the swoosh. */
export const ACCENT_MS = Math.max(
  ...Object.keys(FX)
    .filter((k) => /^(s\d|t\d|sw)\./.test(k))
    .map((k) => FX[k]!.at(-2)![0] - LEAD),
);
