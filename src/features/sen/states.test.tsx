import { act, render, screen } from '@testing-library/react-native';

import { SEN_STATES } from './states';

const hidden = { includeHiddenElements: true };
const face = () => {
  const m = screen.getByTestId('sen-lk', hidden).props.jestAnimatedProps.value.matrix as number[];
  return [m[4], m[5]];
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('the unlock lab holds masked for 600 ms, then plays Unlock and rests happy', async () => {
  const Unlock = SEN_STATES.unlock;
  await render(<Unlock />);

  await act(() => jest.advanceTimersByTime(590));
  expect(face()).toEqual([0, 34]);
  await act(() => jest.advanceTimersByTime(10));
  await act(() => jest.advanceTimersByTime(80));
  expect(face()[1]).toBeCloseTo(46, 0);
  await act(() => jest.advanceTimersByTime(2000));
  expect(face()).toEqual([0, -6]);
});

test('the copy lab plays Copy by request and rests idle', async () => {
  const Copy = SEN_STATES.copy;
  await render(<Copy />);

  await act(() => jest.advanceTimersByTime(600 + 300));
  expect(
    screen.getByTestId('sen-elb', hidden).props.jestAnimatedProps.value.matrix.slice(0, 4),
  ).toEqual([1.15, 0, 0, 0.45]);
});
