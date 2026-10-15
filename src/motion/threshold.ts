import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Calls `onCross(above)` on the JS thread once each time `sv` crosses `at`, in either direction. Never per
 * frame. The pull-to-refresh haptic and the rig's gesture-driven stretch use it.
 */
export function useThreshold(
  sv: SharedValue<number>,
  at: number,
  onCross: (above: boolean) => void,
): void {
  useAnimatedReaction(
    () => sv.get() > at,
    (above, before) => {
      if (before !== null && above !== before) scheduleOnRN(onCross, above);
    },
    [at, onCross],
  );
}
