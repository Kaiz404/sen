import { act, render, screen } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import { Text } from 'react-native';

import { useSecondsLeft } from './countdown';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-16T02:00:00.000Z'));
});
afterEach(() => jest.useRealTimers());

function Label({ deadline }: { deadline: number | null }) {
  return <Text>{`${useSecondsLeft(deadline)}s`}</Text>;
}

test('the label counts down whole seconds to zero', async () => {
  await render(<Label deadline={Date.now() + 30_000} />);
  expect(screen.getByText('30s')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(19_500));
  expect(screen.getByText('11s')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(500));
  expect(screen.getByText('10s')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(10_000));
  expect(screen.getByText('0s')).toBeOnTheScreen();
});

test('no deadline reads as zero', async () => {
  await render(<Label deadline={null} />);
  expect(screen.getByText('0s')).toBeOnTheScreen();
});

test('a new deadline shows its own count on the first frame', async () => {
  const committed: number[] = [];
  function Recorder({ deadline }: { deadline: number | null }) {
    const left = useSecondsLeft(deadline);
    useLayoutEffect(() => {
      committed.push(left);
    });
    return null;
  }
  const view = await render(<Recorder deadline={null} />);

  await view.rerender(<Recorder deadline={Date.now() + 30_000} />);

  expect(committed.slice(0, 2)).toEqual([0, 30]);
});
