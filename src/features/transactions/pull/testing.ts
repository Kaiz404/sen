import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

/**
 * Drags History's list down `travel` pt from the top and lets go, as a finger would. The worklet's calls back
 * to React are scheduled on a timer, so the caller must run under Jest's fake timers.
 */
export function pullDown(travel = 300): void {
  fireGestureHandler(getByGestureTestId('history-pull'), [
    { translationY: 0 },
    { translationY: travel / 2 },
    { translationY: travel },
  ]);
  jest.advanceTimersByTime(1);
}
