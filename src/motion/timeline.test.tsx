import { render, screen } from '@testing-library/react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { kf, useLoopClock } from './timeline';
import { EASE_FN } from './tokens';

test('kf interpolates between stops and clamps outside them', () => {
  const stops = [0, 400, 900];
  const values = [0, -80, 0];
  expect(kf(200, stops, values)).toBe(-40);
  expect(kf(650, stops, values)).toBe(-40);
  expect(kf(-100, stops, values)).toBe(0);
  expect(kf(2000, stops, values)).toBe(0);
});

test("kf eases each segment by its own curve, so MAL2's hop from the n peaks without a corner", () => {
  const stops = [714, 882, 1050];
  const values = [-88, -145, -88];
  const eases = [EASE_FN.hopOut, EASE_FN.hopIn];
  expect(kf(798, stops, values, eases)).toBeCloseTo(-138.48, 2);
  expect(kf(966, stops, values, eases)).toBeCloseTo(-138.48, 2);
  expect(kf(882, stops, values, eases)).toBe(-145);
});

test('kf holds through a repeated stop and jumps at a zero-length segment', () => {
  expect(kf(1600, [1512, 1932, 2100], [-27, -27, -15], [EASE_FN.malSpring])).toBe(-27);
  expect(kf(1200, [1157, 1200, 1200, 1700], [0, 0, 1, 1])).toBe(1);
  expect(kf(1199, [1157, 1200, 1200, 1700], [0, 0, 1, 1])).toBe(0);
});

test('the launch spring curve overshoots by 8.7% at the midpoint of its segment', () => {
  expect(kf(50, [0, 100], [0, 100], [EASE_FN.malSpring])).toBeCloseTo(108.74, 2);
});

function Clock({ running }: { running: boolean }) {
  const clock = useLoopClock(4200, running);
  const style = useAnimatedStyle(() => ({ width: clock.get() }));
  return <Animated.View testID="clock" style={style} />;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('the loop clock runs linearly and wraps at its period', async () => {
  await render(<Clock running />);

  jest.advanceTimersByTime(1200);
  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1200 });

  jest.advanceTimersByTime(4200);
  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1200 });
});

test('a stopped clock holds its value', async () => {
  const view = await render(<Clock running />);
  jest.advanceTimersByTime(1000);

  await view.rerender(<Clock running={false} />);
  jest.advanceTimersByTime(2000);

  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1000 });
});
