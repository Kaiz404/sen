import type { Step, Steps } from './types';

type Euler = {
  readonly at: number;
  readonly a0?: number;
  readonly swings?: number;
  readonly half?: number;
};

/**
 * Euler's-disk settle on `sq` (MAX-Library `.L-wob`, MAX-Spec wobble-settle). Swing i tilts to
 * ±A, A = a0 × (−0.72)^i, out along `outS` and back along `inS`, each half `half` ms (100 by default) × 0.8^i. The tilt
 * reads narrower, scaleX 1 − 0.06·|A|/11. It ends with the clack, 1.03 by 0.97 for 40 ms, then rest.
 */
export function eulerSteps({ at, a0 = 11, swings = 10, half: half0 = 100 }: Euler): {
  'sq.r': Steps;
  'sq.sx': Steps;
  'sq.sy': Steps;
} {
  const r: [Step, ...Step[]] = [{ at, v: 0 }];
  const sx: [Step, ...Step[]] = [{ at, v: 1 }];
  let t = at;
  let a = a0;
  let half = half0;
  for (let i = 0; i < swings; i++) {
    const peak = Math.round(t + half);
    const back = Math.round(t + 2 * half);
    r.push({ at: peak, v: a, ease: 'outS' }, { at: back, v: 0, ease: 'inS' });
    sx.push({ at: peak, v: 1 - (0.06 * Math.abs(a)) / 11, ease: 'outS' }, { at: back, v: 1, ease: 'inS' });
    t += 2 * half;
    a *= -0.72;
    half *= 0.8;
  }
  const end = Math.round(t);
  sx.push({ at: end + 40, v: 1.03, ease: 'outS' }, { at: end + 130, v: 1, ease: 'sine' });
  return {
    'sq.r': r,
    'sq.sx': sx,
    'sq.sy': [
      { at: end, v: 1 },
      { at: end + 40, v: 0.97, ease: 'outS' },
      { at: end + 130, v: 1, ease: 'sine' },
    ],
  };
}

const QUARTER = Math.PI / 2;
const TURN = 2 * Math.PI;

/**
 * The edge spin on `sp.th` (MAX-Spec edge-spin). The intro runs the first quarter in 240 ms on
 * `inS`, so the coin reaches edge-on as it gets up to speed. A lap is one linear turn in 600 ms from
 * there, for a loop.
 */
export function edgeSpin(): { intro: Steps; lap: Steps } {
  return {
    intro: [
      { at: 0, v: 0 },
      { at: 240, v: QUARTER, ease: 'inS' },
    ],
    lap: [
      { at: 0, v: QUARTER },
      { at: 600, v: QUARTER + TURN },
    ],
  };
}
