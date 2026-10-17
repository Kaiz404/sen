import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { stopMoment } from '@/features/sen';
import { MotionPolicyRoot } from '@/motion/policy';

import { NoResults } from './states';

const hidden = { includeHiddenElements: true };
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));
/** Rig units are 140/600 pt at the 140 pt Sen. */
const UNIT = 140 / 600;
const rise = () =>
  (
    getAnimatedStyle(screen.getByTestId('sen-mv', hidden)).transform as { translateY?: number }[]
  ).find((t) => t.translateY !== undefined)?.translateY;

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  stopMoment('no-results');
  jest.useRealTimers();
});

test('a search with no matches plays Sen rising from behind the slip, then settles in the shrug', async () => {
  await render(<NoResults search="zzz" onClear={jest.fn()} />);

  await at(100);
  expect(rise()).toBeCloseTo(70 * UNIT, 1);
  await at(3600);
  expect(rise()).toBeCloseTo(-14 * UNIT, 1);
});

test('Off shows the shrug still, with no rise', async () => {
  await render(
    <MotionPolicyRoot preference="off">
      <NoResults search="zzz" onClear={jest.fn()} />
    </MotionPolicyRoot>,
  );

  await at(100);
  expect(rise()).toBeCloseTo(-14 * UNIT, 1);
});
