/**
 * Every value Sen can animate, in rig units (1 unit = size / 600) and degrees, plus `sp.th` in radians.
 * The static renderer, the animated rig, poses, moments and tests all speak `Frame`.
 * The rig holds one shared value per channel, and each node reads only its own channels.
 */
export const CHANNELS = [
  // Body, on four nested Animated.Views: mv › rl › sq › sp
  'mv.x',
  'mv.y',
  'rl.r',
  'sq.r',
  'sq.k',
  'sq.sx',
  'sq.sy',
  'sp.th',
  // Face group, slides inside the static clip
  'lk.x',
  'lk.y',
  // Eyes: shape about each eye centre, then one opacity per eye state
  'eyeL.sx',
  'eyeL.sy',
  'eyeL.dx',
  'eyeL.dy',
  'eyeL.open',
  'eyeL.shut',
  'eyeR.sx',
  'eyeR.sy',
  'eyeR.dx',
  'eyeR.dy',
  'eyeR.open',
  'eyeR.shut',
  /** Both happy arcs live in one node. A happy pose sets this to 1 and every open and shut to 0. */
  'eyes.happy',
  // Mouth: six pre-drawn paths, crossfaded, never morphed
  'mo.smile',
  'mo.small',
  'mo.grin',
  'mo.frown',
  'mo.flat',
  'mo.o',
  'cheeks',
  // Paws: offset from rest, rotation about the paw centre
  'pawL.x',
  'pawL.y',
  'pawL.r',
  'pawR.x',
  'pawR.y',
  'pawR.r',
  // Props: one opacity each, plus the shades drop
  'prop.magnifier',
  'prop.plug',
  'prop.nightcap',
  'prop.shades',
  'prop.y',
] as const;

export type Channel = (typeof CHANNELS)[number];
export type Frame = Readonly<Record<Channel, number>>;

export const MOUTH_CHANNELS = [
  'mo.smile',
  'mo.small',
  'mo.grin',
  'mo.frown',
  'mo.flat',
  'mo.o',
] as const satisfies readonly Channel[];

export const PROP_CHANNELS = [
  'prop.magnifier',
  'prop.plug',
  'prop.nightcap',
  'prop.shades',
] as const satisfies readonly Channel[];

/** Channels whose rest value is 1: scales, open eyes and the smile. Every other channel rests at 0. */
const RESTS_AT_ONE: ReadonlySet<Channel> = new Set<Channel>([
  'sq.sx',
  'sq.sy',
  'eyeL.sx',
  'eyeL.sy',
  'eyeL.open',
  'eyeR.sx',
  'eyeR.sy',
  'eyeR.open',
  'mo.smile',
]);

/** Idle with eyes open and a smile. Every channel is present, so `{ ...REST, ...partial }` is a Frame. */
export const REST: Frame = Object.freeze(
  Object.fromEntries(CHANNELS.map((ch) => [ch, RESTS_AT_ONE.has(ch) ? 1 : 0])) as Record<
    Channel,
    number
  >,
);

/** Opacity channels. A pose change fades these and springs every other channel. */
const FADES: ReadonlySet<Channel> = new Set<Channel>([
  'eyeL.open',
  'eyeL.shut',
  'eyeR.open',
  'eyeR.shut',
  'eyes.happy',
  ...MOUTH_CHANNELS,
  'cheeks',
  ...PROP_CHANNELS,
]);

/**
 * How a channel moves when a pose changes, read by the rig's `usePose`. `fade` is an opacity,
 * `withTiming(DUR.crossfade)`. `spring` is geometry, `SPRING.settle`. Calm turns both into `DUR.calm`
 * timings, and Off snaps.
 */
export type ChannelKind = 'fade' | 'spring';
export const CHANNEL_KIND: Readonly<Record<Channel, ChannelKind>> = Object.freeze(
  Object.fromEntries(CHANNELS.map((ch) => [ch, FADES.has(ch) ? 'fade' : 'spring'])) as Record<
    Channel,
    ChannelKind
  >,
);
