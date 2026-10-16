import type { MotionLevel } from '@/motion/policy';

import { poseFrame } from '../poses';
import type { Moment } from '../timeline/types';
import { moments, settleInto, startFrom, without } from './build';

/**
 * MAX-Moments `.M-unlock`, 0 to 1370 ms: the face presses down and pops up as the eyes open and the
 * paws go up, accents, one flip on a 120-unit arc, the land, then the happy squint.
 */
export const unlock: Moment = {
  id: 'unlock',
  priority: 2,
  from: 'masked',
  to: 'happy',
  dur: 1370,
  tracks: moments('.M-unlock', 0, 1370),
  marks: [
    { at: 160, haptic: 'unlock' },
    { at: 160, accents: true },
  ],
};

/**
 * How long the screen that asked for the check stays after it passes, so Sen's Unlock shows before
 * History. Full plays the whole moment. Calm and Off hold the happy pose 400 ms, as the launch holds
 * its rest frame.
 */
export const UNLOCK_HOLD: Readonly<Record<MotionLevel, number>> = {
  full: unlock.dur,
  calm: 400,
  off: 400,
};

/**
 * MAX-Moments `.M-reveal`, 0 to 760 ms: eye-pop with a small hop and paws up, accents, then the face
 * slides toward the digits (18, −10) into the happy squint. The tile then loops back to masked, but
 * amounts stay shown (D27), so from 1500 ms Sen eases into `revealed` in 300 ms on `sine`, the time
 * and curve the tile uses to bring its paws down.
 */
export const reveal: Moment = {
  id: 'reveal',
  priority: 2,
  from: 'masked',
  to: 'revealed',
  dur: 1800,
  tracks: settleInto(moments('.M-reveal', 0, 760), poseFrame('revealed'), 1500, 300),
  marks: [{ at: 160, accents: true }],
};

const fromRevealed = (() => {
  const t = without(moments('.M-remask', 600, 1320), ['pl.x', 'pl.y', 'pr.x', 'pr.y']);
  const held = poseFrame('revealed');
  const open = (ch: 'elb.sx' | 'elb.sy' | 'erb.sx' | 'erb.sy') => startFrom(t[ch]!, held[ch]);
  return {
    ...t,
    'elb.sx': open('elb.sx'),
    'elb.sy': open('elb.sy'),
    'erb.sx': open('erb.sx'),
    'erb.sy': open('erb.sy'),
    'sq.r': startFrom(t['sq.r']!, 0),
    'sq.k': startFrom(t['sq.k']!, 0),
  };
})();

/**
 * MAX-Moments `.M-remask` from 600 ms: the eyes squeeze shut, the face ducks behind the rim to
 * (−28, 190) and settles masked at (0, 34) while Sen leans back behind the card. The tile starts from
 * a happy squint with its paws up and a lean. Here it starts from `revealed`, so the eyes squeeze from
 * open, the paws are already down and the lean starts upright. The lean back eases out from 1000 ms
 * in 350 ms, the tile's own return time.
 */
export const remask: Moment = {
  id: 'remask',
  priority: 2,
  from: 'revealed',
  to: 'masked',
  dur: 1350,
  tracks: settleInto(fromRevealed, poseFrame('masked'), 1000, 350),
  marks: [],
};
