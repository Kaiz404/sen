import { type BoardStep, type Keyframes, keyframesOf } from '../board';
import { BOARDS } from '../board.gen';
import type { Channel } from '../channels';

const MAL2: Readonly<Record<string, readonly BoardStep[]>> = BOARDS['MAL2-Loading'][''];
const k = (key: string) => keyframesOf(MAL2[key]!);

/** Sen lands as the period here. The light haptic fires on this frame. */
export const LAND_MS = 1512;
/** The story ends with Sen settled into the period. A launch that isn't ready waits here. */
export const STORY_MS = 2394;
/** Sen has grown into Lock's Sen and the ink panel has shrunk into Lock's hero. */
export const HANDOFF_MS = 3108;
/** Lock's UI has faded in. The loader unmounts. */
export const DONE_MS = 3276;
/** The wait loop: a small hop on the period. MAL-Timelines gives its length only. */
export const HOP_MS = 600;

/** MAL-Timelines: Sen moves as offsets from Lock's Sen, in board px, where Lock's face radius is 101. */
export const BOARD_FACE_R = 101;

/**
 * Where the wordmark and the period sit relative to Lock's Sen centre (331, 397) on the 390 × 844
 * board: the wordmark's right edge at 304 and top at 300, and the period's centre at (290, 382).
 */
export const LAYOUT = { wordmarkRight: -27, wordmarkTop: -97, period: [-41, -15] } as const;

/** The MAL2 swoosh, `M-48 -73 Q-24 -221 0 -12`, is drawn on by length. Measured, in board px. */
export const SWOOSH_D = 'M-48 -73 Q-24 -221 0 -12';
export const SWOOSH_LENGTH = 194;

/**
 * Lock's Sen rests masked, while MAL2 ends with its eyes open. So after the wink the eyes squeeze
 * shut, the face tucks to (0, 34) and the mouth goes small, inside the handoff, as MAX-Library's
 * eye-close does it. This bridge is not on the board.
 */
const CLOSE = 2800;
const bridge = {
  eyeSqueeze: [
    [0, 1],
    [CLOSE, 1],
    [CLOSE + 90, 0.15, 'inQ'],
  ],
  openEye: [
    [0, 1],
    [CLOSE + 90, 1],
    [CLOSE + 110, 0],
  ],
  shutEye: [
    [0, 0],
    [CLOSE + 90, 0],
    [CLOSE + 120, 1],
  ],
  tuck: [
    [0, 0],
    [CLOSE + 60, 0],
    [CLOSE + 260, 34, 'out'],
  ],
  smile: [
    [0, 1],
    [CLOSE + 100, 1],
    [CLOSE + 180, 0],
  ],
  small: [
    [0, 0],
    [CLOSE + 100, 0],
    [CLOSE + 180, 1],
  ],
} as const satisfies Record<string, readonly BoardStep[]>;

const wink: readonly BoardStep[] = [
  ...MAL2['er.sy']!.filter(([at]) => at <= 1890),
  [CLOSE, 1],
  [CLOSE + 90, 0.15, 'inQ'],
];

/** The rig channels the launch moves, each read off the launch clock. Every other channel rests idle. */
export const LAUNCH_RIG: Readonly<Partial<Record<Channel, Keyframes>>> = {
  'sq.k': k('sq.k'),
  'sq.sx': k('sq.sx'),
  'sq.sy': k('sq.sy'),
  'mo.sx': k('mo.sx'),
  'mo.sy': k('mo.sy'),
  'ck.op': k('chk.op'),
  'erb.sy': keyframesOf(wink),
  'elb.sy': keyframesOf(bridge.eyeSqueeze),
  'elb.op': keyframesOf(bridge.openEye),
  'erb.op': keyframesOf(bridge.openEye),
  'elc.op': keyframesOf(bridge.shutEye),
  'erc.op': keyframesOf(bridge.shutEye),
  'lk.y': keyframesOf(bridge.tuck),
  'mo.smile': keyframesOf(bridge.smile),
  'mo.small': keyframesOf(bridge.small),
};

const letter = (n: 1 | 2 | 3) => ({ y: k(`l${n}.y`), sx: k(`l${n}.sx`), sy: k(`l${n}.sy`) });
const spark = (n: 1 | 2 | 3) => ({ op: k(`sp${n}.op`), s: k(`sp${n}.s`), r: k(`sp${n}.r`) });
const tick = (n: 1 | 2 | 3) => ({ op: k(`tk${n}.op`), y: k(`tk${n}.y`), sy: k(`tk${n}.sy`) });

/** MAL2 (`design/MAL2-Loading.dc.html`), every part but the rig, read off one clock. */
export const LAUNCH = {
  x: k('sx.x'),
  y: k('sy.y'),
  scale: k('ss.s'),
  letters: [letter(1), letter(2), letter(3)],
  panel: { inset: k('panel.inset'), round: k('panel.round') },
  wordmark: { y: k('wm.y'), op: k('wm.op') },
  lockUi: k('lk.op'),
  sparks: [spark(1), spark(2), spark(3)],
  ticks: [tick(1), tick(2), tick(3)],
  swoosh: { off: k('sw.off'), op: k('sw.op') },
} as const;

/** The board's panel shrinks by this many px, from the full screen to Lock's hero. */
export const BOARD_PANEL_INSET = 406;

/** The wait hop on the period, in board px. */
export const HOP: Keyframes = keyframesOf([
  [0, 0],
  [240, -18, 'hopOut'],
  [480, 0, 'hopIn'],
  [HOP_MS, 0],
]);
