import type { Moment } from '../timeline/types';
import { moments, without } from './build';

/** MAX-Moments `.M-face.ph-scan`: peek left with the left eye cracked, then right, in a 1.6 s loop. */
export const faceScan: Moment = {
  id: 'faceScan',
  priority: 2,
  from: 'masked',
  to: 'masked',
  dur: 1600,
  tracks: moments('.M-face.ph-scan', 0, 1600),
  marks: [],
  loop: true,
};

/**
 * MAX-Moments `.M-face.ph-fail`: the eyes pop open at 0.9, the face shakes ±16 and settles at
 * (0, 10), Sen counter-leans then leans back to −4° with a frown and paws clutching the rim, and the
 * eyes close again at 1.5 s.
 */
export const authFailed: Moment = {
  id: 'authFailed',
  priority: 3,
  from: 'masked',
  to: 'masked',
  dur: 1850,
  tracks: moments('.M-face.ph-fail', 0, 1850),
  marks: [{ at: 80, haptic: 'authFailed' }],
};

/**
 * MAX-Moments `.M-lockout`, to 1300 ms, without its spin: asleep, a sigh squash, then still. The
 * owner overrides the board's turn edge-on (DESIGN.md › Owner overrides).
 */
export const lockout: Moment = {
  id: 'lockout',
  priority: 3,
  from: 'asleep',
  to: 'asleep',
  dur: 1300,
  tracks: without(moments('.M-lockout', 0, 1300), ['sp.th']),
  marks: [{ at: 0, haptic: 'lockout' }],
  then: 'lockoutBreathe',
};

/**
 * Sen breathes in its sleep, scaleY 1 › 1.02 › 1 over 2 s (MAX-Moments `.M-lockout`, 2600 to
 * 4600 ms, face-on), every 4 s until the cool-down ends.
 */
export const lockoutBreathe: Moment = {
  id: 'lockoutBreathe',
  priority: 3,
  from: 'asleep',
  to: 'asleep',
  dur: 4000,
  tracks: without(moments('.M-lockout', 2600, 4600), ['sp.th']),
  marks: [],
  loop: true,
};
