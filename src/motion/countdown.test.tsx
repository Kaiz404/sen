import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ringOffset, useCountdownProgress, useRevealPhase, useSecondsLeft } from './countdown';
import { MotionPolicyRoot } from './policy';

test('ringOffset empties the ring as progress falls', () => {
  expect(ringOffset(1, 200)).toBe(0);
  expect(ringOffset(0.25, 200)).toBe(150);
  expect(ringOffset(0, 200)).toBe(200);
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-16T02:00:00.000Z'));
});
afterEach(() => jest.useRealTimers());

const start = () => Date.now();

function Label({ deadline }: { deadline: number | null }) {
  return <Text>{`${useSecondsLeft(deadline)}s ${useRevealPhase(deadline)}`}</Text>;
}

test('the label counts whole seconds and turns to ending at 10 s', async () => {
  await render(<Label deadline={start() + 60_000} />);
  expect(screen.getByText('60s revealed')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(49_500));
  expect(screen.getByText('11s revealed')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(500));
  expect(screen.getByText('10s ending')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(10_000));
  expect(screen.getByText('0s ending')).toBeOnTheScreen();
});

test('no deadline reads as zero and revealed', async () => {
  await render(<Label deadline={null} />);
  expect(screen.getByText('0s revealed')).toBeOnTheScreen();
});

function Ring({ deadline }: { deadline: number }) {
  const progress = useCountdownProgress(deadline, 60_000);
  const style = useAnimatedStyle(() => ({ opacity: progress.get() }));
  return <Animated.View testID="ring" style={style} />;
}

test('the ring drains linearly and keeps running when motion is calm', async () => {
  await render(
    <MotionPolicyRoot preference="calm">
      <Ring deadline={start() + 60_000} />
    </MotionPolicyRoot>,
  );

  jest.advanceTimersByTime(15_000);
  expect(screen.getByTestId('ring')).toHaveAnimatedStyle({ opacity: 0.75 });

  jest.advanceTimersByTime(45_000);
  expect(screen.getByTestId('ring')).toHaveAnimatedStyle({ opacity: 0 });
});

test('a ring mounted mid-reveal starts from the time already gone', async () => {
  await render(<Ring deadline={start() + 30_000} />);

  jest.advanceTimersByTime(15_000);
  expect(screen.getByTestId('ring')).toHaveAnimatedStyle({ opacity: 0.25 });
});
