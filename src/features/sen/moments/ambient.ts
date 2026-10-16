import type { PoseId } from '../poses';
import type { Moment, MomentId } from '../timeline/types';
import { library, moments } from './build';

const EYES = ['elb.sy', 'erb.sy'] as const;

/** MAX-Library `.L-blink`: the open layer closes to 0.1 in 60 ms and opens in 80. */
export const blink: Moment = {
  id: 'blink',
  priority: 0,
  from: 'idle',
  to: 'idle',
  dur: 140,
  tracks: library('.L-blink', 1900, 2040),
  calm: EYES,
  marks: [],
};

/** MAX-Moments `.M-idle`, its third beat: two blinks 90 ms apart. */
export const doubleBlink: Moment = {
  id: 'doubleBlink',
  priority: 0,
  from: 'idle',
  to: 'idle',
  dur: 370,
  tracks: moments('.M-idle', 11400, 11770),
  calm: EYES,
  marks: [],
};

/** MAX-Moments `.M-idle`, its second beat: the face glances to (−22, 0) with a blink, and back. */
export const glance: Moment = {
  id: 'glance',
  priority: 0,
  from: 'idle',
  to: 'idle',
  dur: 1100,
  tracks: moments('.M-idle', 6400, 7500),
  calm: EYES,
  marks: [],
};

/** MAX-Moments `.M-lock`: the masked face slides toward Unlock, cracks the right eye, blinks, shuts. */
export const lockPeek: Moment = {
  id: 'lockPeek',
  priority: 0,
  from: 'masked',
  to: 'masked',
  dur: 1460,
  tracks: moments('.M-lock', 3000, 4460),
  marks: [],
};

/** MAX-Moments `.M-err.ph-off`: the worried eyes close slowly and open. */
export const slowBlink: Moment = {
  id: 'slowBlink',
  priority: 0,
  from: 'worried',
  to: 'worried',
  dur: 400,
  tracks: moments('.M-err.ph-off', 2600, 3000),
  calm: EYES,
  marks: [],
};

type Gap = readonly [min: number, max: number];

export type Ambient = {
  readonly beats: readonly { readonly moment: MomentId; readonly weight: number }[];
  readonly gap: Gap;
  /** After this many beats with no other moment, wait longer (MAX-Spec idle). */
  readonly rest?: { readonly after: number; readonly gap: Gap };
};

/**
 * What a Sen does on its own while it rests in a pose. Idle is eyes only (MAX-Spec). Revealed, the
 * month card Sen of MAX-Moments' Idle tile, only blinks: its face sits at (0, −6), where the glance
 * would pull it.
 */
export const AMBIENT: Readonly<Partial<Record<PoseId, Ambient>>> = {
  idle: {
    beats: [
      { moment: 'blink', weight: 70 },
      { moment: 'glance', weight: 20 },
      { moment: 'doubleBlink', weight: 10 },
    ],
    gap: [4000, 7000],
    rest: { after: 3, gap: [10000, 15000] },
  },
  revealed: {
    beats: [
      { moment: 'blink', weight: 70 },
      { moment: 'doubleBlink', weight: 10 },
    ],
    gap: [4000, 7000],
    rest: { after: 3, gap: [10000, 15000] },
  },
  masked: { beats: [{ moment: 'lockPeek', weight: 1 }], gap: [6000, 9000] },
  worried: { beats: [{ moment: 'slowBlink', weight: 1 }], gap: [4000, 7000] },
};

const BLINKS: ReadonlySet<MomentId> = new Set(['blink', 'doubleBlink', 'slowBlink']);
const BEATS: ReadonlySet<MomentId> = new Set(
  Object.values(AMBIENT).flatMap((a) => a.beats.map((b) => b.moment)),
);

/** Whether a moment is one of the beats a Sen plays on its own. */
export function isBeat(moment: MomentId): boolean {
  return BEATS.has(moment);
}

/** Over 120 pt a Sen does everything. From 48 pt it only blinks. Smaller marks stay still. */
export function ambientFor(pose: PoseId, size: number): Ambient | undefined {
  const a = AMBIENT[pose];
  if (!a || size < 48) return undefined;
  if (size > 120) return a;
  const beats = a.beats.filter((b) => BLINKS.has(b.moment));
  return beats.length ? { ...a, beats } : undefined;
}

/** The next ambient beat and how long to wait for it, after `played` beats. */
export function nextBeat(
  a: Ambient,
  played: number,
  random: () => number,
): { moment: MomentId; delay: number } {
  const [lo, hi] = a.rest && played > 0 && played % a.rest.after === 0 ? a.rest.gap : a.gap;
  const delay = Math.round(lo + random() * (hi - lo));
  let pick = random() * a.beats.reduce((sum, b) => sum + b.weight, 0);
  for (const b of a.beats) {
    pick -= b.weight;
    if (pick < 0) return { moment: b.moment, delay };
  }
  return { moment: a.beats[a.beats.length - 1]!.moment, delay };
}
