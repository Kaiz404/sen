import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Android's gesture bar is at most about 32 dp tall and the 3-button bar is 48 dp, so an inset from 40 dp
 * up is the button bar (inferred: Android exposes no JS flag for the navigation mode).
 */
const BUTTON_BAR_MIN = 40;

/**
 * A theme-coloured scrim behind the 3-button navigation bar. Edge to edge the bar is transparent, and the
 * system's own contrast scrim is too faint to keep scrolled rows from showing through its buttons. The
 * gesture bar needs none: it has no buttons to read. `hidden` is for a screen whose ground isn't the
 * canvas, such as Lock.
 */
export function NavScrim({ hidden = false }: { readonly hidden?: boolean }): ReactNode {
  const { rt } = useUnistyles();
  if (hidden || rt.insets.bottom < BUTTON_BAR_MIN) return null;
  return <View testID="nav-scrim" pointerEvents="none" style={styles.scrim} />;
}

const styles = StyleSheet.create((theme, rt) => ({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: rt.insets.bottom,
    backgroundColor: theme.colors.canvas,
  },
}));
