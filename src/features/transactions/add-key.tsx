import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, type LayoutChangeEvent } from 'react-native';
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
/** How far the key rises clear of the undo toast. */
export const ADD_KEY_LIFT = TOAST_RISE + TOAST_GAP - REST_BOTTOM;

type Span = { readonly y: number; readonly height: number };

/**
 * True when the key, at its resting place or lifted, would sit over content that is drawn at `content`
 * after the list scrolled by `offset`. All y values are in the list slot's own coordinates.
 */
export function keyCoversContent(
  key: Span,
  lifted: boolean,
  content: Span,
  offset: number,
): boolean {
  const keyTop = key.y - (lifted ? ADD_KEY_LIFT : 0);
  const keyBottom = keyTop + key.height;
  const top = content.y - offset;
  return top < keyBottom && top + content.height > keyTop;
}

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
export function AddKey({
  onPress,
  hidden = false,
  onLayout,
}: {
  readonly onPress: () => void;
  /** Fades the key out and takes it off the touch map, while it would sit over a control. */
  readonly hidden?: boolean;
  readonly onLayout?: (e: LayoutChangeEvent) => void;
}): ReactNode {
  const level = useMotionPolicy();
  const lifted = useToastShowing();
  const typing = useKeyboardUp();
  if (typing) return null;
  return (
    <Animated.View
      testID="add-key"
      onLayout={onLayout}
      pointerEvents={hidden ? 'none' : 'auto'}
      aria-hidden={hidden}
      style={[
        styles.dock,
        {
          transform: [{ translateY: lifted ? -ADD_KEY_LIFT : 0 }],
          opacity: hidden ? 0 : 1,
          transitionProperty: ['transform', 'opacity'],
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
