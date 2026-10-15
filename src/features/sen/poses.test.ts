import { CHANNEL_KIND, CHANNELS, type Frame, MOUTH_CHANNELS, PROP_CHANNELS } from './channels';
import { POSE_IDS, poseFrame, PROP_IDS, type PropId } from './poses';

const PROP_CHOICES: (PropId | null | undefined)[] = [undefined, null, ...PROP_IDS];
const cases = POSE_IDS.flatMap((pose) =>
  PROP_CHOICES.map((prop) => [pose, String(prop), prop] as const),
);

const on = (frame: Frame, channels: readonly (keyof Frame)[]) =>
  channels.filter((ch) => frame[ch] === 1);

describe.each(cases)('%s with prop %s', (pose, _, prop) => {
  const frame = poseFrame(pose, prop);

  test('every channel is present', () => {
    expect(Object.keys(frame).sort()).toEqual([...CHANNELS].sort());
  });

  test('exactly one mouth is at 1 and the others are at 0', () => {
    expect(on(frame, MOUTH_CHANNELS)).toHaveLength(1);
    expect(MOUTH_CHANNELS.map((ch) => frame[ch]).sort()).toEqual([0, 0, 0, 0, 0, 1]);
  });

  test.each([
    ['left', ['eyeL.open', 'eyeL.shut', 'eyes.happy']],
    ['right', ['eyeR.open', 'eyeR.shut', 'eyes.happy']],
  ] as const)('the %s eye is in exactly one state', (__, states) => {
    expect(states.map((ch) => frame[ch]).sort()).toEqual([0, 0, 1]);
  });

  test('at most one prop is worn', () => {
    expect(on(frame, PROP_CHANNELS).length).toBeLessThanOrEqual(1);
  });
});

test('a pose wears its default prop unless the caller overrides it', () => {
  expect(on(poseFrame('asleep'), PROP_CHANNELS)).toEqual(['prop.nightcap']);
  expect(on(poseFrame('asleep', null), PROP_CHANNELS)).toEqual([]);
  expect(on(poseFrame('shrug', 'magnifier'), PROP_CHANNELS)).toEqual(['prop.magnifier']);
});

test('shrug matches kit.py: face up-left, paws out and up, flat mouth', () => {
  const f = poseFrame('shrug');
  expect([f['lk.x'], f['lk.y'], f['pawL.x'], f['pawL.y'], f['pawR.x'], f['pawR.y']]).toEqual([
    -16, -14, -70, -80, 20, -70,
  ]);
  expect(on(f, MOUTH_CHANNELS)).toEqual(['mo.flat']);
});

test('peek closes the left eye and opens the right a crack', () => {
  const f = poseFrame('peek');
  expect([f['eyeL.shut'], f['eyeR.open'], f['eyeR.sx'], f['eyeR.sy'], f['sq.r']]).toEqual([
    1, 1, 1.05, 0.45, -2.4,
  ]);
});

test('opacity channels fade and geometry channels spring', () => {
  expect([
    CHANNEL_KIND['mo.grin'],
    CHANNEL_KIND['prop.shades'],
    CHANNEL_KIND['eyes.happy'],
  ]).toEqual(['fade', 'fade', 'fade']);
  expect([CHANNEL_KIND['lk.x'], CHANNEL_KIND['prop.y'], CHANNEL_KIND['eyeL.sy']]).toEqual([
    'spring',
    'spring',
    'spring',
  ]);
});
