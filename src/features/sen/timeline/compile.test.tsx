import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import Animated, { getAnimatedStyle, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { poseFrame } from '../poses';
import { compileTrack, entry, formFor } from './compile';
import type { Moment, Steps } from './types';

const LOOK: Steps = [
  { at: 0, v: 0 },
  { at: 140, v: -26, ease: 'out' },
  { at: 1100, v: -26 },
  { at: 1300, v: 0, ease: 'sine' },
];

function Probe({ steps, dur, loop }: { steps: Steps; dur: number; loop?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(compileTrack(steps, dur, loop));
  }, [v, steps, dur, loop]);
  const style = useAnimatedStyle(() => ({ width: v.get() }));
  return <Animated.View testID="probe" style={style} />;
}

const width = () => getAnimatedStyle(screen.getByTestId('probe')).width as number;
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("a compiled look-left glances to -26 on the board's out curve, holds, and returns on sine", async () => {
  await render(<Probe steps={LOOK} dur={1300} />);

  await at(70);
  expect(width()).toBeCloseTo(-24.6, 1);
  await at(530);
  expect(width()).toBe(-26);
  await at(650);
  expect(width()).toBeCloseTo(-3.76, 1);
  await at(100);
  expect(width()).toBe(0);
});

test('a looping track starts each lap over and pads the lap to the moment length', async () => {
  const lap: Steps = [
    { at: 0, v: 0 },
    { at: 100, v: 10 },
  ];
  await render(<Probe steps={lap} dur={200} loop />);

  await at(50);
  expect(width()).toBeCloseTo(5, 0);
  await at(100);
  expect(width()).toBe(10);
  await at(100);
  expect(width()).toBeCloseTo(5, 0);
});

test('a moment that cuts in eases a channel to its first value over 80 ms instead of jumping', () => {
  expect(entry(LOOK, 12)).toEqual([
    { at: 80, v: 0, ease: 'out' },
    { at: 140, v: -26, ease: 'out' },
    { at: 1100, v: -26 },
    { at: 1300, v: 0, ease: 'sine' },
  ]);
  expect(entry(LOOK, 0)).toBe(LOOK);
});

const POP: Moment = {
  id: 'reveal',
  priority: 2,
  from: 'masked',
  to: 'revealed',
  dur: 760,
  tracks: {
    'mv.y': [
      { at: 160, v: 0 },
      { at: 280, v: -22, ease: 'outQ' },
      { at: 380, v: 0, ease: 'inQ' },
    ],
    'elb.sy': [
      { at: 0, v: 0.1 },
      { at: 260, v: 1.12, ease: 'out' },
      { at: 380, v: 1, ease: 'sine' },
    ],
  },
  calm: ['elb.sy'],
  marks: [
    { at: 160, accents: true },
    { at: 200, haptic: 'reveal' },
  ],
};

test('Calm keeps the calm tracks and crossfades every other pose change in 150 ms, haptic on time', () => {
  const calm = formFor(POP, 'calm', poseFrame('masked'), poseFrame('revealed'));

  expect(calm.tracks['mv.y']).toBeUndefined();
  expect(calm.tracks['elb.sy']).toBe(POP.tracks['elb.sy']);
  expect(calm.tracks['lk.y']).toEqual([{ at: 150, v: -6 }]);
  expect(calm.tracks['mo.grin']).toEqual([{ at: 150, v: 1 }]);
  expect(calm.marks).toEqual([{ at: 200, haptic: 'reveal' }]);
  expect(calm.dur).toBe(380);
});

test('Off snaps every channel to the end pose and still plays the haptic', () => {
  const off = formFor(POP, 'off', poseFrame('masked'), poseFrame('revealed'));

  expect(off.tracks['lk.y']).toEqual([{ at: 0, v: -6 }]);
  expect(off.tracks['elb.sy']).toBeUndefined();
  expect(off.marks).toEqual([{ at: 200, haptic: 'reveal' }]);
  expect(off.dur).toBe(200);
});
