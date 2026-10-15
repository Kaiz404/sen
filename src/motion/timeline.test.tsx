import { render, screen } from '@testing-library/react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { kf, useLoopClock } from './timeline';

test('kf interpolates between stops and clamps outside them', () => {
  const stops = [0, 400, 900];
  const values = [0, -80, 0];
  expect(kf(200, stops, values)).toBe(-40);
  expect(kf(650, stops, values)).toBe(-40);
  expect(kf(-100, stops, values)).toBe(0);
  expect(kf(2000, stops, values)).toBe(0);
});

function Clock({ running }: { running: boolean }) {
  const clock = useLoopClock(4800, running);
  const style = useAnimatedStyle(() => ({ width: clock.get() }));
  return <Animated.View testID="clock" style={style} />;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('the loop clock runs linearly and wraps at its period', async () => {
  await render(<Clock running />);

  jest.advanceTimersByTime(1200);
  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1200 });

  jest.advanceTimersByTime(4800);
  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1200 });
});

test('a stopped clock holds its value', async () => {
  const view = await render(<Clock running />);
  jest.advanceTimersByTime(1000);

  await view.rerender(<Clock running={false} />);
  jest.advanceTimersByTime(2000);

  expect(screen.getByTestId('clock')).toHaveAnimatedStyle({ width: 1000 });
});
