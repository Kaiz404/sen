import { act, render, screen } from '@testing-library/react-native';
import { Profiler, type ReactNode } from 'react';
import { getAnimatedStyle } from 'react-native-reanimated';

import { type MotionLevel, MotionPolicyRoot } from '@/motion/policy';
import { playHaptic } from '@/services/haptics';

import { playMoment } from '../director/store';
import { Sen } from '../index';
import type { PoseId } from '../poses';

jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));

const hidden = { includeHiddenElements: true };
const props = (node: string) => screen.getByTestId(`sen-${node}`, hidden).props.jestAnimatedProps.value;
const matrix = (node: string) => props(node).matrix as number[];
const face = () => [matrix('lk')[4], matrix('lk')[5]];
const style = (node: string) => getAnimatedStyle(screen.getByTestId(`sen-${node}`, hidden));
const lift = () => (style('mv').transform as { translateY: number }[])[1]!.translateY;
const spin = () => (style('sp').transform as { scaleX: number }[])[0]!.scaleX;
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

function Lock({ pose, level = 'full', children }: { pose: PoseId; level?: MotionLevel; children?: ReactNode }) {
  return (
    <MotionPolicyRoot preference={level}>
      <Sen id="lock" pose={pose} size={300} />
      {children}
    </MotionPolicyRoot>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(playHaptic).mockClear();
});
afterEach(() => jest.useRealTimers());

test('Unlock follows .M-unlock: press to 46, pop to -14, flip over a 120-unit arc, squint at -6', async () => {
  const view = await render(<Lock pose="masked" />);
  expect(face()).toEqual([0, 34]);

  await view.rerender(<Lock pose="happy" />);
  await at(80);
  expect(face()[1]).toBeCloseTo(46, 0);
  await at(180);
  expect(face()[1]).toBeCloseTo(-14, 0);
  await at(560);
  expect(lift()).toBeCloseTo(-60, 0);
  expect(spin()).toBeCloseTo(-1, 2);
  await at(550);

  expect(face()).toEqual([0, -6]);
  expect(spin()).toBeCloseTo(1, 6);
  expect(matrix('elb').slice(0, 4)).toEqual([1.15, 0, 0, 0.45]);
  expect(matrix('pl').slice(4)).toEqual([-128, -180]);
  expect(props('mo-grin').opacity).toBe(1);
});

test('Unlock played on a Sen still resting masked eases back to masked when it ends', async () => {
  await render(<Lock pose="masked" />);

  await act(() => playMoment('lock', 'unlock'));
  await at(3000);

  expect(face()).toEqual([0, 34]);
});

test('Unlock fires the success haptic at 160 ms, from the clock, and pops the accents with it', async () => {
  await render(<Lock pose="masked" />);
  await act(() => playMoment('lock', 'unlock'));

  await at(150);
  expect(playHaptic).not.toHaveBeenCalled();
  expect(props('fx-s1').opacity).toBe(0);
  await at(20);
  expect(playHaptic).toHaveBeenCalledWith('unlock');
  await at(230);
  expect(props('fx-s1').opacity).toBeCloseTo(1, 2);
  await at(800);
  expect(props('fx-s1').opacity).toBe(0);
});

test('in Calm, Unlock crossfades into happy in 150 ms with no hop or flip, and keeps its haptic', async () => {
  const view = await render(<Lock pose="masked" level="calm" />);
  await view.rerender(<Lock pose="happy" level="calm" />);

  await at(80);
  expect(face()[1]).toBeCloseTo(12.7, 0);
  await at(90);
  expect(face()).toEqual([0, -6]);
  expect(playHaptic).toHaveBeenCalledWith('unlock');
  await at(650);
  expect(lift()).toBe(0);
  expect(spin()).toBe(1);
  expect(props('fx-s1').opacity).toBe(0);
});

test('with animations off, Unlock snaps to happy and still plays its haptic', async () => {
  const view = await render(<Lock pose="masked" level="off" />);
  await view.rerender(<Lock pose="happy" level="off" />);

  await at(20);
  expect(face()).toEqual([0, -6]);
  await at(150);
  expect(playHaptic).toHaveBeenCalledWith('unlock');
});

test('showing amounts plays Reveal: the face slides to the digits (18, -10), then rests revealed', async () => {
  const view = await render(<Lock pose="masked" />);

  await view.rerender(<Lock pose="revealed" />);
  await at(210);
  expect(playHaptic).toHaveBeenCalledWith('reveal');
  await at(550);
  expect(face()).toEqual([18, -10]);
  expect(matrix('elb').slice(0, 4)).toEqual([1.15, 0, 0, 0.45]);
  await at(1100);

  expect(face()).toEqual([0, -6]);
  expect(matrix('elb').slice(0, 4)).toEqual([1, 0, 0, 1]);
  expect(matrix('pl').slice(4)).toEqual([0, 0]);
});

test('hiding amounts plays Re-mask: the face ducks behind the rim at (-28, 190), then tucks masked', async () => {
  const view = await render(<Lock pose="revealed" />);

  await view.rerender(<Lock pose="masked" />);
  await at(140);
  expect(props('elb').opacity).toBe(0);
  expect(props('elc').opacity).toBe(1);
  await at(160);
  expect(face()).toEqual([-28, 190]);
  await at(1100);

  expect(face()).toEqual([0, 34]);
  expect(lift()).toBe(0);
  expect(props('mo-small').opacity).toBe(1);
});

test('a moment plays with no React commits after it starts', async () => {
  let commits = 0;
  const tree = (pose: PoseId) => (
    <Profiler id="sen" onRender={() => commits++}>
      <Lock pose={pose} />
    </Profiler>
  );
  const view = await render(tree('masked'));
  await view.rerender(tree('happy'));
  commits = 0;

  await at(1400);

  expect(commits).toBe(0);
  expect(face()).toEqual([0, -6]);
});
