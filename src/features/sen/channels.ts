/** Rig units (1 unit = size / 600) and degrees, except `sp.th`, which is radians. */
export const CHANNELS = [
  'mv.x',
  'mv.y',
  'rl.r',
  'sq.r',
  'sq.k',
  'sq.sx',
  'sq.sy',
  'sp.th',
  'lk.x',
  'lk.y',
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
  'eyes.happy',
  'mo.smile',
  'mo.small',
  'mo.grin',
  'mo.frown',
  'mo.flat',
  'mo.o',
  'cheeks',
  'pawL.x',
  'pawL.y',
  'pawL.r',
  'pawR.x',
  'pawR.y',
  'pawR.r',
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

export const REST: Frame = Object.freeze(
  Object.fromEntries(CHANNELS.map((ch) => [ch, RESTS_AT_ONE.has(ch) ? 1 : 0])) as Record<
    Channel,
    number
  >,
);

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

export type ChannelKind = 'fade' | 'spring';
export const CHANNEL_KIND: Readonly<Record<Channel, ChannelKind>> = Object.freeze(
  Object.fromEntries(CHANNELS.map((ch) => [ch, FADES.has(ch) ? 'fade' : 'spring'])) as Record<
    Channel,
    ChannelKind
  >,
);
