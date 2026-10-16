const RIG = {
  mv: { x: 0, y: 0, op: 1 },
  rl: { r: 0 },
  sq: { r: 0, k: 0, sx: 1, sy: 1 },
  sp: { th: 0 },
  ck: { op: 0 },
  lk: { x: 0, y: 0 },
  el: { x: 0, y: 0, sx: 1, sy: 1 },
  elb: { sx: 1, sy: 1, op: 1 },
  elc: { sx: 1, sy: 1, op: 0 },
  er: { x: 0, y: 0, sx: 1, sy: 1 },
  erb: { sx: 1, sy: 1, op: 1 },
  erc: { sx: 1, sy: 1, op: 0 },
  mo: { sx: 1, sy: 1, smile: 1, small: 0, grin: 0, frown: 0, flat: 0, o: 0 },
  shades: { x: 0, y: 0, r: 0, op: 0 },
  cap: { x: 0, y: 0, r: 0, op: 0 },
  pl: { x: 0, y: 0, r: 0, s: 1 },
  plf: { x: 0, y: 0, r: 0, s: 1 },
  pr: { x: 0, y: 0, r: 0, s: 1 },
  prf: { x: 0, y: 0, r: 0, s: 1 },
  prop: { magnifier: 0, plug: 0 },
} as const;

type Rig = typeof RIG;
export type RigNode = keyof Rig;
export type Channel = { [N in RigNode]: `${N}.${keyof Rig[N] & string}` }[RigNode];
export type Frame = Readonly<Record<Channel, number>>;

export const REST: Frame = Object.freeze(
  Object.fromEntries(
    Object.entries(RIG).flatMap(([node, props]) =>
      Object.entries(props).map(([prop, rest]) => [`${node}.${prop}`, rest]),
    ),
  ) as Record<Channel, number>,
);

export const CHANNELS = Object.keys(REST) as readonly Channel[];

export const MOUTH_IDS = ['smile', 'small', 'grin', 'frown', 'flat', 'o'] as const;
export type MouthId = (typeof MOUTH_IDS)[number];
export const MOUTH_CHANNELS = MOUTH_IDS.map((m) => `mo.${m}` as const);

export const HELD_PROP_IDS = ['magnifier', 'plug'] as const;
export type HeldPropId = (typeof HELD_PROP_IDS)[number];

const FADES: ReadonlySet<Channel> = new Set<Channel>([
  ...CHANNELS.filter((ch) => ch.endsWith('.op')),
  ...MOUTH_CHANNELS,
  ...HELD_PROP_IDS.map((p) => `prop.${p}` as const),
]);

export type ChannelKind = 'fade' | 'spring';
export const CHANNEL_KIND: Readonly<Record<Channel, ChannelKind>> = Object.freeze(
  Object.fromEntries(CHANNELS.map((ch) => [ch, FADES.has(ch) ? 'fade' : 'spring'])) as Record<
    Channel,
    ChannelKind
  >,
);
