import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { cssMs } from '@/components/motion-level';
import { Key } from '@/components/key';
import { TOAST_ENTER_MS, TOAST_EXIT_MS, TOAST_RISE, useToastShowing } from '@/components/toast';
import { useMotionPolicy } from '@/motion/policy';
import { EASE_CSS } from '@/motion/tokens';

const REST_BOTTOM = 16;
const KEY_HEIGHT = 64;
/** List-end padding above the bottom inset, so the last row and caption stay clear of the key. */
export const ADD_KEY_CLEARANCE = REST_BOTTOM + KEY_HEIGHT + 24;
const TOAST_GAP = 16;
const LIFT = TOAST_RISE + TOAST_GAP - REST_BOTTOM;

function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}

/**
 * History's floating Add key. It rises with the undo toast on the toast's own timing (Material lifts a
 * FAB above a snackbar), jumps outside Full motion, and gets out of the way of the search keyboard.
 */
export function AddKey({ onPress }: { readonly onPress: () => void }): ReactNode {
  const level = useMotionPolicy();
  const lifted = useToastShowing();
  const typing = useKeyboardUp();
  if (typing) return null;
  return (
    <Animated.View
      testID="add-key"
      style={[
        styles.dock,
        {
          transform: [{ translateY: lifted ? -LIFT : 0 }],
          transitionProperty: 'transform',
          transitionDuration: cssMs(level, lifted ? TOAST_ENTER_MS : TOAST_EXIT_MS),
          transitionTimingFunction: EASE_CSS.out,
        },
      ]}
    >
      <Key
        tone="loud"
        size="xlarge"
        icon="plus"
        accessibilityLabel="Add a transaction"
        onPress={onPress}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create((_theme, rt) => ({
  dock: { position: 'absolute', right: 20, bottom: rt.insets.bottom + REST_BOTTOM, zIndex: 2 },
}));
