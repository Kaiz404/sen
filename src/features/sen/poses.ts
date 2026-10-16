import { type Channel, type Frame, MOUTH_IDS, type MouthId, REST } from './channels';

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

export const PROP_IDS = ['magnifier', 'plug', 'nightcap', 'shades'] as const;
export type PropId = (typeof PROP_IDS)[number];

export type EyesKind = 'open' | 'closed' | 'peek' | 'happy' | 'worried' | 'squint';

type Vec = readonly [x: number, y: number];

/**
 * One eye as a pose holds it: which of the open and shut layers shows, and the pose layer's
 * offset and scale. The open and shut layers stay at scale 1 in a pose, so a blink, an eye-close
 * or a peek crack can run on them over whatever the pose holds.
 */
type EyeHold = { readonly shut: boolean; readonly at: Vec; readonly scale: Vec };

/** A paw's pose layer: offset, rotation in degrees about the paw centre, uniform scale. */
type PawHold = { readonly at: Vec; readonly r: number; readonly s: number };

export type PoseSpec = {
  /** `lk`: the face group's slide across the disc. */
  readonly face: Vec;
  readonly eyes: EyesKind;
  readonly mouth: MouthId;
  readonly cheeks: number;
  /** `mv.y`: the whole coin lifts (negative) or sinks. */
  readonly lift: number;
  /** `sq.r`: lean about the contact point. */
  readonly lean: number;
  /** `sq.k`: the counter skewX the boards pair with nearly every lean. */
  readonly skew: number;
  /** `sq.sx`, `sq.sy`. */
  readonly squash: Vec;
  readonly pawL: PawHold;
  readonly pawR: PawHold;
  readonly prop: PropId | null;
};

const rest: Vec = [0, 0];
const paw = (x: number, y: number, r = 0, s = 1): PawHold => ({ at: [x, y], r, s });
const still = paw(0, 0);

export const POSE_SPECS: Readonly<Record<PoseId, PoseSpec>> = {
  idle: spec({ eyes: 'open', mouth: 'smile' }),
  masked: spec({ face: [0, 34], eyes: 'closed', mouth: 'small' }),
  peek: spec({ face: [22, 24], eyes: 'peek', mouth: 'small', lean: -2.4, skew: 2 }),
  revealed: spec({ face: [0, -6], eyes: 'open', mouth: 'grin', cheeks: 0.3 }),
  happy: spec({
    face: [0, -6],
    eyes: 'happy',
    mouth: 'grin',
    cheeks: 0.3,
    pawL: paw(-128, -180),
    pawR: paw(128, -180),
  }),
  look: spec({ face: [64, -44], eyes: 'open', mouth: 'smile', lean: 2.6, skew: -2.4 }),
  lookdown: spec({ face: [-64, 70], eyes: 'open', mouth: 'smile', lean: -3, skew: 3 }),
  worried: spec({
    eyes: 'worried',
    mouth: 'frown',
    lean: -4,
    skew: 3,
    pawL: paw(66, -56, 0, 0.9),
    pawR: paw(-66, -56, 0, 0.9),
  }),
  asleep: spec({
    face: [0, 48],
    eyes: 'closed',
    mouth: 'small',
    pawL: paw(36, -6),
    pawR: paw(-36, -6),
    prop: 'nightcap',
  }),
  shrug: spec({
    face: [-16, -14],
    eyes: 'open',
    mouth: 'flat',
    lift: -14,
    lean: 2,
    skew: -2,
    squash: [0.98, 1.03],
    pawL: paw(-70, -80, -20),
    pawR: paw(70, -80, 20),
  }),
  squint: spec({ eyes: 'squint', mouth: 'flat' }),
  cool: spec({ eyes: 'open', mouth: 'smile', prop: 'shades' }),
};

function spec(p: Partial<PoseSpec> & Pick<PoseSpec, 'eyes' | 'mouth'>): PoseSpec {
  return {
    face: rest,
    cheeks: 0,
    lift: 0,
    lean: 0,
    skew: 0,
    squash: [1, 1],
    pawL: still,
    pawR: still,
    prop: null,
    ...p,
  };
}

const open = (scale: Vec = [1, 1], at: Vec = rest): EyeHold => ({ shut: false, at, scale });
const shut: EyeHold = { shut: true, at: rest, scale: [1, 1] };
const both = (e: EyeHold) => ({ L: e, R: e });

export const EYES: Readonly<Record<EyesKind, { readonly L: EyeHold; readonly R: EyeHold }>> = {
  open: both(open()),
  closed: both(shut),
  peek: { L: shut, R: open([1.05, 0.45]) },
  happy: both(open([1.15, 0.45])),
  worried: { L: open([0.85, 0.85], [10, 8]), R: open([0.85, 0.85], [-10, 8]) },
  squint: both(open([1.15, 0.35])),
};

const WORN: Readonly<Record<PropId, Channel>> = {
  magnifier: 'prop.magnifier',
  plug: 'prop.plug',
  nightcap: 'cap.op',
  shades: 'shades.op',
};

export function poseFrame(pose: PoseId, prop?: PropId | null): Frame {
  const s = POSE_SPECS[pose];
  const worn = prop === undefined ? s.prop : prop;
  const frame: Record<Channel, number> = {
    ...REST,
    'mv.y': s.lift,
    'sq.r': s.lean,
    'sq.k': s.skew,
    'sq.sx': s.squash[0],
    'sq.sy': s.squash[1],
    'ck.op': s.cheeks,
    'lk.x': s.face[0],
    'lk.y': s.face[1],
  };
  holdEye(frame, 'el', EYES[s.eyes].L);
  holdEye(frame, 'er', EYES[s.eyes].R);
  holdPaw(frame, 'pl', s.pawL);
  holdPaw(frame, 'pr', s.pawR);
  for (const m of MOUTH_IDS) frame[`mo.${m}`] = m === s.mouth ? 1 : 0;
  if (worn !== null) frame[WORN[worn]] = 1;
  return frame;
}

function holdEye(frame: Record<Channel, number>, n: 'el' | 'er', e: EyeHold): void {
  frame[`${n}.x`] = e.at[0];
  frame[`${n}.y`] = e.at[1];
  frame[`${n}.sx`] = e.scale[0];
  frame[`${n}.sy`] = e.scale[1];
  frame[`${n}b.op`] = e.shut ? 0 : 1;
  frame[`${n}c.op`] = e.shut ? 1 : 0;
}

function holdPaw(frame: Record<Channel, number>, n: 'pl' | 'pr', p: PawHold): void {
  frame[`${n}.x`] = p.at[0];
  frame[`${n}.y`] = p.at[1];
  frame[`${n}.r`] = p.r;
  frame[`${n}.s`] = p.s;
}
