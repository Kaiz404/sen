import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { stopMoment } from '@/features/sen';
import { MotionPolicyRoot } from '@/motion/policy';

import { playHaptic as haptic } from '@/services/haptics';

import { EmptyHistory, FullError, NoResults } from './states';

jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
const playHaptic = jest.mocked(haptic);

const hidden = { includeHiddenElements: true };
const at = async (ms: number) => act(() => jest.advanceTimersByTime(ms));
/** Rig units are 140/600 pt at the 140 pt Sen. */
const UNIT = 140 / 600;
const rise = () =>
  (
    getAnimatedStyle(screen.getByTestId('sen-mv', hidden)).transform as { translateY?: number }[]
  ).find((t) => t.translateY !== undefined)?.translateY;

beforeEach(() => {
  jest.useFakeTimers();
  playHaptic.mockClear();
});
afterEach(() => {
  stopMoment('no-results');
  stopMoment('history-failed');
  jest.useRealTimers();
});

test('a search with no matches plays Sen rising from behind the slip, then settles in the shrug', async () => {
  await render(<NoResults search="zzz" onClear={jest.fn()} />);

  expect(screen.getByTestId('sen-rig-no-results', hidden)).toBeOnTheScreen();
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

test('Sen is hidden until the first paint, so the settled pose never shows before the rise', async () => {
  await render(<NoResults search="zzz" onClear={jest.fn()} />);
  expect(screen.getByTestId('history-no-results-sen', hidden)).toHaveStyle({ opacity: 0 });

  await at(100);
  expect(screen.getByTestId('history-no-results-sen')).toHaveStyle({ opacity: 1 });
});

const face = () =>
  (screen.getByTestId('sen-lk', hidden).props.jestAnimatedProps.value.matrix as number[]).slice(4);
const OFFLINE = { kind: 'offline' } as const;
const lean = () =>
  (getAnimatedStyle(screen.getByTestId('sen-sq', hidden)).transform as { rotate?: string }[]).find(
    (t) => t.rotate !== undefined,
  )?.rotate;

test('the failed state plays Network error on arrival and buzzes once, at the moment’s mark', async () => {
  await render(<FullError error={OFFLINE} onRetry={jest.fn()} onSettings={jest.fn()} />);

  await at(200);
  expect(playHaptic.mock.calls).toEqual([['networkError']]);
  expect(lean()).not.toBe('0deg');
});

test('Retry plays Sen’s glance up at the button and still retries', async () => {
  const onRetry = jest.fn();
  await render(<FullError error={OFFLINE} onRetry={onRetry} onSettings={jest.fn()} />);
  await at(2000);
  const rested = face();

  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  await at(300);
  expect(face()).not.toEqual(rested);
});

test('the empty history Sen is a rig, so its idle blinks run', async () => {
  await render(<EmptyHistory />);
  expect(screen.getByTestId('sen-rig-history-empty', hidden)).toBeOnTheScreen();
});
