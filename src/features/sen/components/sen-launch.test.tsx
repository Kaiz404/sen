import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { getAnimatedStyle } from 'react-native-reanimated';

import { type MotionLevel, MotionPolicyRoot } from '@/motion/policy';
import { playHaptic } from '@/services/haptics';

import { SenLaunch } from './sen-launch';

jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));

const hidden = { includeHiddenElements: true };
/** Lock's face radius equals the board's 101 px, so board px read one to one. */
const TARGET = { sen: { x: 100, y: 200, size: (600 * 101) / 222 }, heroHeight: 438 };

type Move = { translateX: number; translateY: number; scale: number };
const sen = (): Move =>
  Object.assign({}, ...(getAnimatedStyle(screen.getByTestId('launch-sen', hidden)).transform as object[]));
const rig = (node: string) => screen.getByTestId(`sen-${node}`, hidden).props.jestAnimatedProps.value;
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));

function Launch({ ready, onDone, level = 'full' }: { ready: boolean; onDone: () => void; level?: MotionLevel }) {
  return (
    <MotionPolicyRoot preference={level}>
      <SenLaunch target={TARGET} ready={ready} onDone={onDone} />
    </MotionPolicyRoot>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(playHaptic).mockClear();
});
afterEach(() => jest.useRealTimers());

test('frame 0 is the splash: Sen small, off to the left and high, before it falls onto the S', async () => {
  await render(<Launch ready={false} onDone={jest.fn()} />);

  const s = sen();
  expect([s.translateX, s.translateY, s.scale]).toEqual([expect.closeTo(-371, 0), expect.closeTo(-247, 0), 0.22]);
  await at(378);
  expect([sen().translateX, sen().translateY]).toEqual([expect.closeTo(-209, 0), expect.closeTo(-111, 0)]);
});

test('Sen lands as the period at 1512 ms with a light haptic, squashed 1.3 by 0.7', async () => {
  await render(<Launch ready={false} onDone={jest.fn()} />);

  await at(1500);
  expect(playHaptic).not.toHaveBeenCalled();
  await at(12);
  const squash = Object.assign(
    {},
    ...(getAnimatedStyle(screen.getByTestId('sen-sq', hidden)).transform as object[]),
  ) as { scaleX: number; scaleY: number };
  expect([squash.scaleX, squash.scaleY]).toEqual([expect.closeTo(1.3, 2), expect.closeTo(0.7, 2)]);
  expect(sen().translateY).toBeCloseTo(-27, 0);
  await at(8);
  expect(playHaptic).toHaveBeenCalledWith('copy');
});

test('it winks at 1743 ms: the right eye shuts to 0.12 and the left stays open', async () => {
  await render(<Launch ready={false} onDone={jest.fn()} />);

  await at(1743);

  expect(rig('erb').matrix[3]).toBeCloseTo(0.12, 2);
  expect(rig('elb').matrix[3]).toBe(1);
});

test('when Lock is not ready, Sen hops on the period and the loader stays', async () => {
  const onDone = jest.fn();
  await render(<Launch ready={false} onDone={onDone} />);

  await at(2394 + 240);
  expect(sen().translateY).toBeCloseTo(-33, 0);
  await at(4000);
  expect(onDone).not.toHaveBeenCalled();
});

test('the handoff grows Sen into Lock’s Sen, eyes shut, as the panel shrinks into Lock’s hero', async () => {
  const onDone = jest.fn();
  const view = await render(<Launch ready={false} onDone={onDone} />);
  await at(2394);
  await view.rerender(<Launch ready onDone={onDone} />);

  await at(600 + 3108 - 2394);
  expect([sen().translateX, sen().translateY, sen().scale]).toEqual([0, 0, 1]);
  expect(getAnimatedStyle(screen.getByTestId('launch-panel', hidden)).height).toBe(438);
  expect(rig('elc').opacity).toBe(1);
  expect(rig('lk').matrix[5]).toBe(34);
  expect(onDone).not.toHaveBeenCalled();
  await at(3276 - 3108 + 20);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the launch plays with no React commits', async () => {
  let commits = 0;
  await render(
    <Profiler id="launch" onRender={() => commits++}>
      <Launch ready={false} onDone={jest.fn()} />
    </Profiler>,
  );
  await at(0);
  commits = 0;

  await at(2394);

  expect(commits).toBe(0);
});

test('in Calm the launch holds the rest frame 400 ms, fades to Lock in 200 ms, with no haptic', async () => {
  const onDone = jest.fn();
  await render(<Launch ready level="calm" onDone={onDone} />);

  await at(300);
  const s = sen();
  expect([s.translateX, s.translateY, s.scale]).toEqual([-41, -15, 0.12]);
  await at(320);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(playHaptic).not.toHaveBeenCalled();
});
