import { slice } from '../board';
import type { Moment, Steps, Tracks } from '../timeline/types';
import { endAt, moments, MOMENTS_BOARD, startFrom } from './build';

const hop = moments('.M-copy', 0, 1640);

/**
 * MAX-Moments `.M-copy`, to 1640 ms: a hop of 60 out from the slip, paws up, the happy squint, grin
 * and cheeks, accents, then the squint relaxes from 1500 ms. The tile perches at a lean of 3° with
 * a −4° skew, which no pose holds, so the hop starts and ends upright here.
 */
const copyTracks: Tracks = {
  ...hop,
  'sq.r': endAt(startFrom(hop['sq.r']!, 0), 0),
  'sq.k': endAt(startFrom(hop['sq.k']!, 0), 0),
};

export const copy: Moment = {
  id: 'copy',
  priority: 1,
  from: 'idle',
  to: 'idle',
  dur: 1640,
  tracks: copyTracks,
  marks: [
    { at: 0, haptic: 'copy' },
    { at: 200, accents: true },
  ],
};

/** Saved after Add. DESIGN: as unlock, smaller, from the same vocabulary. Copy's hop with the success haptic. */
export const saved: Moment = {
  id: 'saved',
  priority: 1,
  from: 'idle',
  to: 'idle',
  dur: 1640,
  tracks: copyTracks,
  marks: [
    { at: 0, haptic: 'saved' },
    { at: 200, accents: true },
  ],
};

/**
 * MAX-Moments `.M-dark.ph-light`, to 980 ms: a hard squint (1.2, 0.3) with a recoil of 8, then the
 * sunglasses drop in with one overshoot and stay.
 */
export const themeLight: Moment = {
  id: 'themeLight',
  priority: 1,
  from: 'idle',
  to: 'cool',
  dur: 980,
  tracks: moments('.M-dark.ph-light', 0, 980),
  marks: [],
};

const SHADES = MOMENTS_BOARD['.M-dark.ph-light']!;
const off = (key: 'shades.y' | 'shades.op'): Steps => {
  const [head, ...rest] = slice(SHADES[key]!, { from: 2700, to: 2950 });
  return [head!, ...rest];
};

/**
 * MAX-Moments `.M-dark.ph-dark`, to 1640 ms: squint (1.15, 0.5), the eyes scan ±12, then relax with a
 * blink. Sen starts cool here, so the sunglasses first lift off as they do at the end of `.ph-light`.
 */
export const themeDark: Moment = {
  id: 'themeDark',
  priority: 1,
  from: 'cool',
  to: 'idle',
  dur: 1640,
  tracks: {
    ...moments('.M-dark.ph-dark', 0, 1640),
    'shades.y': off('shades.y'),
    'shades.op': off('shades.op'),
  },
  marks: [],
};
