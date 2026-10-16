import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { type MotionLevel, MotionPolicyRoot } from '@/motion/policy';
import { playHaptic } from '@/services/haptics';

import { playMoment } from '../director/store';
import { Sen } from '../index';
import type { PoseId, PropId } from '../poses';

jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));

const hidden = { includeHiddenElements: true };
const props = (node: string) =>
  screen.getByTestId(`sen-${node}`, hidden).props.jestAnimatedProps.value;
const face = () => [props('lk').matrix[4], props('lk').matrix[5]] as const;
const body = (node: string) =>
  Object.assign(
    {},
    ...(getAnimatedStyle(screen.getByTestId(`sen-${node}`, hidden)).transform as object[]),
  );
const spin = () => body('sp').scaleX as number;
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));
const play = async (moment: Parameters<typeof playMoment>[1]) => act(() => playMoment('s', moment));

/** 600 units to 600 pt, so body offsets read in rig units. */
function S({ pose, prop, level = 'full' }: { pose: PoseId; prop?: PropId; level?: MotionLevel }) {
  return (
    <MotionPolicyRoot preference={level}>
      <Sen id="s" pose={pose} prop={prop} size={600} />
    </MotionPolicyRoot>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(playHaptic).mockClear();
});
afterEach(() => jest.useRealTimers());

test('Auth failed pops the eyes open at 0.9, shakes the face ±16 and closes them again', async () => {
  await render(<S pose="masked" />);
  await play('authFailed');

  await at(90);
  expect(playHaptic).toHaveBeenCalledWith('authFailed');
  await at(170);
  expect(face()).toEqual([expect.closeTo(-16, 0), expect.closeTo(10, 0)]);
  await at(160);
  expect(face()[0]).toBeCloseTo(16, 0);
  expect(props('elb').matrix.slice(0, 4)).toEqual([0.9, 0, 0, 0.9]);
  await at(1500);
  expect(face()).toEqual([0, 34]);
  expect(props('elc').opacity).toBe(1);
});

test('Lockout sighs, turns edge-on and breathes as a pill', async () => {
  await render(<S pose="asleep" />);
  await play('lockout');

  await at(20);
  expect(playHaptic).toHaveBeenCalledWith('lockout');
  await at(1290);
  expect(spin()).toBeCloseTo(0.04, 2);
  expect(props('edge').opacity).toBe(1);
  await at(1000);
  expect(body('sq').scaleY).toBeCloseTo(1.02, 3);
  await at(5000);
  expect(spin()).toBeCloseTo(0.04, 2);
});

test('the refresh spin turns once every 600 ms, then lands on heads with a wobble', async () => {
  await render(<S pose="idle" />);
  await play('refreshSpin');

  await at(240 + 150);
  expect(spin()).toBeCloseTo(-1, 2);
  await at(600 * 3);
  expect(spin()).toBeCloseTo(-1, 2);

  await play('refreshLand');
  await at(120);
  expect(body('mv').translateY).toBeCloseTo(-100, 0);
  await at(270);
  expect(playHaptic).toHaveBeenCalledWith('refreshLanded');
  await at(155);
  expect(body('sq').rotate).toBe('8deg');
  await at(1500);
  expect(spin()).toBe(1);
  expect(body('sq').rotate).toBe('0deg');
});

test('Network error leans the worried Sen back to -8 degrees, then returns to its lean', async () => {
  await render(<S pose="worried" prop="plug" />);
  await play('networkError');

  await at(110);
  expect(playHaptic).toHaveBeenCalledWith('networkError');
  await at(190);
  expect(body('sq').rotate).toBe('-8deg');
  expect(props('plf').matrix[0]).toBeCloseTo(0.9, 3);
  await at(1600);
  expect(body('sq').rotate).toBe('-4deg');
  expect(props('prop-plug').opacity).toBe(1);
});

test('Copy hops 60 out from the slip with the happy squint, and the light haptic on the copy', async () => {
  await render(<S pose="idle" />);
  await play('copy');

  await at(20);
  expect(playHaptic).toHaveBeenCalledWith('copy');
  await at(400);
  expect(body('mv').translateY).toBeCloseTo(-60, 0);
  expect(props('elb').matrix.slice(0, 4)).toEqual([1.15, 0, 0, 0.45]);
  await at(1300);
  expect(body('mv').translateY).toBe(0);
  expect(props('elb').matrix.slice(0, 4)).toEqual([1, 0, 0, 1]);
  expect(body('sq').rotate).toBe('0deg');
});

test('Empty search rises from behind the slip, looks both ways, and ends in the shrug', async () => {
  await render(<S pose="shrug" prop="magnifier" />);
  await play('emptySearch');

  await at(100);
  expect(body('mv').translateY).toBeCloseTo(70, 0);
  await at(540);
  expect(face()[0]).toBe(-24);
  await at(700);
  expect(face()[0]).toBe(24);
  await at(2200);
  expect(face()).toEqual([-16, -14]);
  expect(body('mv').translateY).toBe(-14);
  expect(props('prop-magnifier').opacity).toBe(1);
});

test('switching to light mode squints hard, then the sunglasses drop in and stay', async () => {
  const view = await render(<S pose="idle" />);

  await view.rerender(<S pose="cool" />);
  await at(120);
  expect(props('elb').matrix.slice(0, 4)).toEqual([1.2, 0, 0, 0.3]);
  expect(props('shades').opacity).toBe(0);
  await at(740);
  expect(props('shades').opacity).toBe(1);
  expect(props('shades').matrix[5]).toBe(0);
  await at(500);
  expect(props('mo-smile').opacity).toBe(1);
});

test('switching to dark mode lifts the sunglasses off, squints and scans, and ends idle', async () => {
  const view = await render(<S pose="cool" />);

  await view.rerender(<S pose="idle" />);
  await at(260);
  expect(props('shades').opacity).toBe(0);
  expect(face()[0]).toBe(-12);
  await at(1500);
  expect(face()).toEqual([0, 0]);
  expect(props('elb').matrix.slice(0, 4)).toEqual([1, 0, 0, 1]);
});

test('in Calm the Face ID scan keeps the masked pose still', async () => {
  await render(<S pose="masked" level="calm" />);
  await play('faceScan');

  await at(220);

  expect(face()).toEqual([0, 34]);
  expect(props('elb').opacity).toBe(0);
});
