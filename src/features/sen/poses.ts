import { type Channel, type Frame, MOUTH_CHANNELS, PROP_CHANNELS, REST } from './channels';

export const POSE_IDS = [
  'idle',
  'masked',
  'peek',
  'revealed',
  'happy',
  'look',
  'lookdown',
  'worried',
  'asleep',
  'shrug',
  'squint',
  'cool',
] as const;
export type PoseId = (typeof POSE_IDS)[number];

export const MOUTH_IDS = ['smile', 'small', 'grin', 'frown', 'flat', 'o'] as const;
export type MouthId = (typeof MOUTH_IDS)[number];
export type EyesKind = 'open' | 'closed' | 'peek' | 'happy' | 'worried' | 'squint';
export const PROP_IDS = ['magnifier', 'plug', 'nightcap', 'shades'] as const;
export type PropId = (typeof PROP_IDS)[number];

type Vec = readonly [x: number, y: number];

/**
 * A pose as kit.py writes it: one eyes kind, one mouth, at most one prop. The discrete choices are single
 * fields, so a pose can't name two mouths. `poseFrame` expands it into opacity channels.
 */
export type PoseSpec = {
  /** `lk` offset. */
  readonly face: Vec;
  readonly eyes: EyesKind;
  readonly mouth: MouthId;
  /** 0 to 0.3. */
  readonly cheeks: number;
  /** `sq.r`, degrees about the contact point (10, 278). */
  readonly lean: number;
  readonly pawL: Vec;
  readonly pawR: Vec;
  /** The prop this pose wears by default. `<Sen prop>` overrides it. */
  readonly prop: PropId | null;
};

const rest: Vec = [0, 0];

/** kit.py POSES, plus DESIGN's default props: asleep wears the nightcap, cool wears the shades. */
export const POSE_SPECS: Readonly<Record<PoseId, PoseSpec>> = {
  idle: spec({ eyes: 'open', mouth: 'smile' }),
  masked: spec({ face: [0, 34], eyes: 'closed', mouth: 'small' }),
  peek: spec({ face: [22, 24], eyes: 'peek', mouth: 'small', lean: -2.4 }),
  revealed: spec({ face: [0, -8], eyes: 'open', mouth: 'grin', cheeks: 0.3 }),
  happy: spec({
    face: [0, -8],
    eyes: 'happy',
    mouth: 'grin',
    cheeks: 0.3,
    pawL: [-128, -180],
    pawR: [128, -180],
  }),
  look: spec({ face: [64, -44], eyes: 'open', mouth: 'smile', lean: 2.6 }),
  lookdown: spec({ face: [-64, 70], eyes: 'open', mouth: 'smile', lean: -3 }),
  worried: spec({ eyes: 'worried', mouth: 'frown', lean: -4, pawL: [66, -56], pawR: [-66, -56] }),
  asleep: spec({
    face: [0, 48],
    eyes: 'closed',
    mouth: 'small',
    pawL: [36, -6],
    pawR: [-36, -6],
    prop: 'nightcap',
  }),
  shrug: spec({ face: [-16, -14], eyes: 'open', mouth: 'flat', pawL: [-70, -80], pawR: [20, -70] }),
  squint: spec({ eyes: 'squint', mouth: 'flat' }),
  cool: spec({ eyes: 'open', mouth: 'smile', prop: 'shades' }),
};

function spec(p: Partial<PoseSpec> & Pick<PoseSpec, 'eyes' | 'mouth'>): PoseSpec {
  return { face: rest, cheeks: 0, lean: 0, pawL: rest, pawR: rest, prop: null, ...p };
}

type EyeChannel = Extract<Channel, `eyeL.${string}` | `eyeR.${string}` | 'eyes.happy'>;
type EyeSide = { open?: 1; shut?: 1; sx?: number; sy?: number; dx?: number; dy?: number };

function eyes(l: EyeSide, r: EyeSide, happy: 0 | 1 = 0): Readonly<Record<EyeChannel, number>> {
  const side = (s: EyeSide) => ({
    sx: s.sx ?? 1,
    sy: s.sy ?? 1,
    dx: s.dx ?? 0,
    dy: s.dy ?? 0,
    open: s.open ?? 0,
    shut: s.shut ?? 0,
  });
  const L = side(l);
  const R = side(r);
  return {
    'eyeL.sx': L.sx,
    'eyeL.sy': L.sy,
    'eyeL.dx': L.dx,
    'eyeL.dy': L.dy,
    'eyeL.open': L.open,
    'eyeL.shut': L.shut,
    'eyeR.sx': R.sx,
    'eyeR.sy': R.sy,
    'eyeR.dx': R.dx,
    'eyeR.dy': R.dy,
    'eyeR.open': R.open,
    'eyeR.shut': R.shut,
    'eyes.happy': happy,
  };
}

/** Each eyes kind as channel values. Worried is kit's rx 12 ry 17 eye, nudged in by 10 and down by 8. */
export const EYES: Readonly<Record<EyesKind, Readonly<Record<EyeChannel, number>>>> = {
  open: eyes({ open: 1 }, { open: 1 }),
  closed: eyes({ shut: 1 }, { shut: 1 }),
  peek: eyes({ shut: 1 }, { open: 1, sx: 1.05, sy: 0.45 }),
  happy: eyes({}, {}, 1),
  worried: eyes(
    { open: 1, sx: 12 / 14, sy: 17 / 20, dx: 10, dy: 8 },
    { open: 1, sx: 12 / 14, sy: 17 / 20, dx: -10, dy: 8 },
  ),
  squint: eyes({ open: 1, sx: 1.15, sy: 0.35 }, { open: 1, sx: 1.15, sy: 0.35 }),
};

const MOUTH_CHANNEL: Readonly<Record<MouthId, (typeof MOUTH_CHANNELS)[number]>> = {
  smile: 'mo.smile',
  small: 'mo.small',
  grin: 'mo.grin',
  frown: 'mo.frown',
  flat: 'mo.flat',
  o: 'mo.o',
};

const PROP_CHANNEL: Readonly<Record<PropId, (typeof PROP_CHANNELS)[number]>> = {
  magnifier: 'prop.magnifier',
  plug: 'prop.plug',
  nightcap: 'prop.nightcap',
  shades: 'prop.shades',
};

/**
 * The full Frame for a pose: REST, then the spec, then the prop. `prop` undefined keeps the pose's default,
 * and `null` removes it.
 */
export function poseFrame(pose: PoseId, prop?: PropId | null): Frame {
  const s = POSE_SPECS[pose];
  const worn = prop === undefined ? s.prop : prop;
  const frame: Record<Channel, number> = {
    ...REST,
    'lk.x': s.face[0],
    'lk.y': s.face[1],
    ...EYES[s.eyes],
    cheeks: s.cheeks,
    'sq.r': s.lean,
    'pawL.x': s.pawL[0],
    'pawL.y': s.pawL[1],
    'pawR.x': s.pawR[0],
    'pawR.y': s.pawR[1],
  };
  for (const ch of MOUTH_CHANNELS) frame[ch] = 0;
  frame[MOUTH_CHANNEL[s.mouth]] = 1;
  for (const ch of PROP_CHANNELS) frame[ch] = 0;
  if (worn !== null) frame[PROP_CHANNEL[worn]] = 1;
  return frame;
}
