import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PULL } from './pull-math';
import { LAND_MS, PullToRefresh, type PullStatus } from './pull-refresh';
import { pullDown } from './testing';

jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
const { playHaptic } = jest.requireMock('@/services/haptics');

const noop = () => {};

function Pull({
  status = 'idle',
  onRefresh = noop,
  onSettled = noop,
}: {
  status?: PullStatus;
  onRefresh?: () => void;
  onSettled?: () => void;
}) {
  return (
    <PullToRefresh status={status} onRefresh={onRefresh} onSettled={onSettled} still>
      {() => <Text>list</Text>}
    </PullToRefresh>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  playHaptic.mockClear();
});
afterEach(() => jest.useRealTimers());

test('letting go past 72 pt asks for a refresh once, with a tick at the threshold', async () => {
  const onRefresh = jest.fn();
  await render(<Pull onRefresh={onRefresh} />);

  await act(() => pullDown(300));

  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(playHaptic).toHaveBeenCalledWith('refreshThreshold');
  expect(playHaptic).toHaveBeenCalledTimes(1);
});

test('letting go short of 72 pt does not refresh and closes the gap', async () => {
  const onRefresh = jest.fn();
  await render(<Pull onRefresh={onRefresh} />);

  await act(() => pullDown(100));
  await act(() => jest.advanceTimersByTime(400));

  expect(onRefresh).not.toHaveBeenCalled();
  expect(screen.getByTestId('pull-gap')).toHaveAnimatedStyle({ height: 0 });
});

test('while the bank is asked the gap holds open and says so', async () => {
  await render(<Pull status="loading" />);
  await act(() => jest.advanceTimersByTime(400));

  expect(screen.getByTestId('pull-gap')).toHaveAnimatedStyle({ height: PULL.hold });
  expect(screen.getByText('CHECKING WITH YOUR BANK')).toBeOnTheScreen();
});

test('after the data lands, Sen has its landing before the gap is told it may close', async () => {
  const onSettled = jest.fn();
  await render(<Pull status="landed" onSettled={onSettled} />);

  await act(() => jest.advanceTimersByTime(LAND_MS - 1));
  expect(onSettled).not.toHaveBeenCalled();

  await act(() => jest.advanceTimersByTime(1));
  expect(onSettled).toHaveBeenCalledTimes(1);
});

test('a pull is ignored while a refresh runs', async () => {
  const onRefresh = jest.fn();
  await render(<Pull status="loading" onRefresh={onRefresh} />);

  await act(() => pullDown(300));

  expect(onRefresh).not.toHaveBeenCalled();
});
