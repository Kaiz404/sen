import { poseFrame } from '../poses';
import { edgeSpin, eulerSteps } from '../timeline/generators';
import type { Moment } from '../timeline/types';
import { moments, settleInto, shift } from './build';

/**
 * MAX-Moments `.M-err.ph-off`: from the worried lean Sen leans back to −8° with a 7° skew, holds at
 * −6.5°, and returns. The paws squeeze the plug on the secondary layer, to 0.9.
 */
export const networkError: Moment = {
  id: 'networkError',
  priority: 3,
  from: 'worried',
  to: 'worried',
  dur: 1800,
  tracks: moments('.M-err.ph-off', 0, 1800),
  marks: [{ at: 100, haptic: 'networkError' }],
};

/** MAX-Moments `.M-err.ph-retry`: Sen glances up at Retry, half hops and sags back worried. */
export const networkRetry: Moment = {
  id: 'networkRetry',
  priority: 1,
  from: 'worried',
  to: 'worried',
  dur: 1800,
  tracks: moments('.M-err.ph-retry', 0, 1800),
  marks: [],
};

const spin = edgeSpin();

/**
 * The refresh spin starts (MAX-Spec edge-spin): the first quarter in 240 ms, as the face lifts to
 * (0, −10), as on `.M-ref.ph-spin`. It hands over to the loop.
 */
export const refreshSpin: Moment = {
  id: 'refreshSpin',
  priority: 1,
  from: 'idle',
  to: 'idle',
  dur: 240,
  tracks: {
    'sp.th': spin.intro,
    'lk.y': [
      { at: 0, v: 0 },
      { at: 240, v: -10, ease: 'out' },
    ],
  },
  marks: [],
  then: 'refreshSpinLoop',
};

/** One linear turn every 600 ms while the data loads (MAX-Moments `.M-ref.ph-spin`). */
export const refreshSpinLoop: Moment = {
  id: 'refreshSpinLoop',
  priority: 1,
  from: 'idle',
  to: 'idle',
  dur: 600,
  tracks: { 'sp.th': spin.lap, 'lk.y': [{ at: 0, v: -10 }] },
  marks: [],
  loop: true,
};

/** Sen rises 100 units while the spin springs to the next heads-up turn, before the board's drop. */
const RISE = 120;
const land = moments('.M-ref.ph-land', 0, 330);
const wobble = eulerSteps({ at: 330, a0: 8, swings: 6, half: 95 });
const [, ...wobbleSx] = wobble['sq.sx'];

/**
 * The data is back (MAX-Moments `.M-ref.ph-land`): the spin springs to the next heads-up turn while
 * Sen rises, then drops, lands squashed 1.16 by 0.84 with a light haptic, and settles with the Euler
 * wobble, 6 swings from 8°. The rise is not on the tile, which starts in the air.
 */
export const refreshLand: Moment = {
  id: 'refreshLand',
  priority: 1,
  from: 'idle',
  to: 'idle',
  dur: RISE + 1161,
  tracks: {
    'sp.th': [{ at: 0, v: 2 * Math.PI, spring: 'settle' }],
    'mv.y': [
      { at: 0, v: 0 },
      { at: RISE, v: -100, ease: 'outQ' },
      { at: RISE + 260, v: 0, ease: 'inQ' },
    ],
    ...shift(
      {
        'sq.r': wobble['sq.r'],
        'sq.sx': [...land['sq.sx']!, ...wobbleSx],
        'sq.sy': [...land['sq.sy']!, ...wobble['sq.sy']],
      },
      RISE,
    ),
  },
  marks: [{ at: RISE + 260, haptic: 'refreshLanded' }],
};

/**
 * MAX-Moments `.M-empty`, to 3300 ms: Sen rises from behind the slip, looks left and right with the
 * magnifier, and shrugs. Then it eases into the shrug pose in 200 ms. It opens hidden behind the
 * slip, 70 units down, which no pose draws.
 */
export const emptySearch: Moment = {
  id: 'emptySearch',
  priority: 1,
  from: 'shrug',
  to: 'shrug',
  dur: 3500,
  tracks: settleInto(moments('.M-empty', 0, 3300), poseFrame('shrug'), 3300, 200),
  marks: [],
};
