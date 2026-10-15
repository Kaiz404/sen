import { render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Easing, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useThreshold } from './threshold';

function Pull({ onCross }: { onCross: (above: boolean) => void }) {
  const pull = useSharedValue(0);
  useThreshold(pull, 72, onCross);
  useEffect(() => {
    const linear = { duration: 1000, easing: Easing.linear };
    pull.set(withSequence(withTiming(100, linear), withTiming(0, linear)));
  }, [pull]);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('fires once going over the threshold and once coming back', async () => {
  const onCross = jest.fn();
  await render(<Pull onCross={onCross} />);

  jest.advanceTimersByTime(900);
  expect(onCross.mock.calls).toEqual([[true]]);

  jest.advanceTimersByTime(1100);
  expect(onCross.mock.calls).toEqual([[true], [false]]);
});
