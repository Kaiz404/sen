import { CHANNEL_KIND, CHANNELS, type Channel, type Frame, MOUTH_CHANNELS, REST } from './channels';
import { POSE_IDS, type PoseId, poseFrame, PROP_IDS, type PropId } from './poses';

const PROP_CHOICES: (PropId | null | undefined)[] = [undefined, null, ...PROP_IDS];
const cases = POSE_IDS.flatMap((pose) =>
  PROP_CHOICES.map((prop) => [pose, String(prop), prop] as const),
);
const WORN: readonly Channel[] = ['prop.magnifier', 'prop.plug', 'cap.op', 'shades.op'];

const on = (frame: Frame, channels: readonly Channel[]) => channels.filter((ch) => frame[ch] === 1);

describe.each(cases)('%s with prop %s', (pose, _, prop) => {
  const frame = poseFrame(pose, prop);

  test('every channel is present', () => {
    expect(Object.keys(frame).sort()).toEqual([...CHANNELS].sort());
  });

  test('exactly one mouth is at 1 and the others are at 0', () => {
    expect(MOUTH_CHANNELS.map((ch) => frame[ch]).sort()).toEqual([0, 0, 0, 0, 0, 1]);
  });

  test.each([
    ['left', ['elb.op', 'elc.op']],
    ['right', ['erb.op', 'erc.op']],
  ] as const)('the %s eye shows exactly one of its open and shut layers', (__, layers) => {
    expect(layers.map((ch) => frame[ch]).sort()).toEqual([0, 1]);
  });

  test('at most one prop is worn', () => {
    expect(on(frame, WORN).length).toBeLessThanOrEqual(1);
  });
});

test('the rest frame is the boards at rest: eyes open, smiling, everything at scale 1', () => {
  expect(on(REST, CHANNELS).sort()).toEqual(
    [
      'mv.op',
      'sq.sx',
      'sq.sy',
      'el.sx',
      'el.sy',
      'elb.sx',
      'elb.sy',
      'elb.op',
      'elc.sx',
      'elc.sy',
      'er.sx',
      'er.sy',
      'erb.sx',
      'erb.sy',
      'erb.op',
      'erc.sx',
      'erc.sy',
      'mo.sx',
      'mo.sy',
      'mo.smile',
      'pl.s',
      'plf.s',
      'pr.s',
      'prf.s',
    ].sort(),
  );
  expect(CHANNELS.filter((ch) => REST[ch] !== 0 && REST[ch] !== 1)).toEqual([]);
});

const shut = { 'elb.op': 0, 'elc.op': 1, 'erb.op': 0, 'erc.op': 1 };
const small = { 'mo.smile': 0, 'mo.small': 1 };
const grin = { 'mo.smile': 0, 'mo.grin': 1 };
const flat = { 'mo.smile': 0, 'mo.flat': 1 };

const BOARD: Readonly<Record<PoseId, Partial<Record<Channel, number>>>> = {
  idle: {},
  masked: { 'lk.y': 34, ...shut, ...small },
  peek: {
    'lk.x': 22,
    'lk.y': 24,
    'sq.r': -2.4,
    'sq.k': 2,
    'elb.op': 0,
    'elc.op': 1,
    'er.sx': 1.05,
    'er.sy': 0.45,
    ...small,
  },
  revealed: { 'lk.y': -6, 'ck.op': 0.3, ...grin },
  happy: {
    'lk.y': -6,
    'el.sx': 1.15,
    'el.sy': 0.45,
    'er.sx': 1.15,
    'er.sy': 0.45,
    'ck.op': 0.3,
    'pl.x': -128,
    'pl.y': -180,
    'pr.x': 128,
    'pr.y': -180,
    ...grin,
  },
  look: { 'lk.x': 64, 'lk.y': -44, 'sq.r': 2.6, 'sq.k': -2.4 },
  lookdown: { 'lk.x': -64, 'lk.y': 70, 'sq.r': -3, 'sq.k': 3 },
  worried: {
    'sq.r': -4,
    'sq.k': 3,
    'el.x': 10,
    'el.y': 8,
    'el.sx': 0.85,
    'el.sy': 0.85,
    'er.x': -10,
    'er.y': 8,
    'er.sx': 0.85,
    'er.sy': 0.85,
    'pl.x': 66,
    'pl.y': -56,
    'pl.s': 0.9,
    'pr.x': -66,
    'pr.y': -56,
    'pr.s': 0.9,
    'mo.smile': 0,
    'mo.frown': 1,
  },
  asleep: {
    'lk.y': 48,
    'pl.x': 36,
    'pl.y': -6,
    'pr.x': -36,
    'pr.y': -6,
    'cap.op': 1,
    ...shut,
    ...small,
  },
  shrug: {
    'mv.y': -14,
    'sq.r': 2,
    'sq.k': -2,
    'sq.sx': 0.98,
    'sq.sy': 1.03,
    'lk.x': -16,
    'lk.y': -14,
    'pl.x': -70,
    'pl.y': -80,
    'pl.r': -20,
    'pr.x': 70,
    'pr.y': -80,
    'pr.r': 20,
    ...flat,
  },
  squint: { 'el.sx': 1.15, 'el.sy': 0.35, 'er.sx': 1.15, 'er.sy': 0.35, ...flat },
  cool: { 'shades.op': 1 },
};

test.each(POSE_IDS)(
  '%s settles on its board values and leaves every other channel at rest',
  (pose) => {
    expect(poseFrame(pose)).toEqual({ ...REST, ...BOARD[pose] });
  },
);

test('a pose wears its default prop unless the caller overrides it', () => {
  expect(on(poseFrame('asleep'), WORN)).toEqual(['cap.op']);
  expect(on(poseFrame('asleep', null), WORN)).toEqual([]);
  expect(on(poseFrame('shrug', 'magnifier'), WORN)).toEqual(['prop.magnifier']);
});

test('opacity channels fade and geometry channels spring', () => {
  expect([
    CHANNEL_KIND['mo.grin'],
    CHANNEL_KIND['shades.op'],
    CHANNEL_KIND['elc.op'],
    CHANNEL_KIND['prop.plug'],
  ]).toEqual(['fade', 'fade', 'fade', 'fade']);
  expect([CHANNEL_KIND['lk.x'], CHANNEL_KIND['shades.y'], CHANNEL_KIND['elb.sy']]).toEqual([
    'spring',
    'spring',
    'spring',
  ]);
});
