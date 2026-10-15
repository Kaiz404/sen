import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
