import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useMotionPolicy } from '@/motion/policy';
import { DUR, EASE_CSS } from '@/motion/tokens';
import type { Palette } from '@/theme/colors';
import { FONT } from '@/theme/type';

import { cssMs } from './motion-level';
import { standIn } from './stand-in';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
/** `loud` is the screen's one loud key: ink in light, lemon in dark. */
export type KeyTone = 'lemon' | 'loud' | 'paper';
export type KeySize = 'regular' | 'large';

type KeyProps = {
  readonly onPress: () => void;
  readonly tone?: KeyTone;
  readonly size?: KeySize;
} & (
  | { readonly label: string; readonly icon?: IconName; readonly accessibilityLabel?: string }
  | { readonly label?: undefined; readonly icon: IconName; readonly accessibilityLabel: string }
);

const SIZE = {
  regular: { height: 46, radius: 15, font: 17, icon: 21, gap: 4 },
  large: { height: 56, radius: 18, font: 18, icon: 22, gap: 10 },
} as const;

const KEY_DROP = 4;

export function Key({
  onPress,
  tone = 'paper',
  size = 'regular',
  label,
  icon,
  accessibilityLabel,
}: KeyProps): ReactNode {
  const [pressed, setPressed] = useState(false);
  const level = useMotionPolicy();
  const s = SIZE[size];
  const iconOnly = label === undefined;
  const { theme, rt } = useUnistyles();
  const c = keyColors(theme.colors, rt.themeName)[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.key, { height: s.height + KEY_DROP }, iconOnly && { width: s.height }]}
    >
      <View
        style={[
          styles.plate,
          { height: s.height, borderRadius: s.radius, backgroundColor: c.plate },
        ]}
      />
      <Animated.View
        testID="key-face"
        style={[
          styles.face,
          { height: s.height, borderRadius: s.radius, gap: s.gap },
          { backgroundColor: c.face, borderColor: c.edge },
          iconOnly ? styles.iconOnly : styles.labelled,
          {
            transform: [{ translateY: pressed ? KEY_DROP : 0 }],
            transitionProperty: 'transform',
            transitionDuration: cssMs(level, DUR.press),
            transitionTimingFunction: EASE_CSS.out,
          },
        ]}
      >
        {icon !== undefined && <MaterialCommunityIcons name={icon} size={s.icon} color={c.ink} />}
        {label !== undefined && (
          <Text style={[styles.label, { fontSize: s.font, color: c.ink }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Tone colours, read in render through useUnistyles. On the device a live theme switch left the label inside
 * the animated face on the old theme, so the key takes its colours from the hook, which re-renders it.
 */
function keyColors(c: Palette, themeName: string | undefined) {
  const s = standIn(c, themeName);
  const tone = (face: string, edge: string, ink: string) => ({
    face,
    edge,
    ink,
    plate: s.keyPlate,
  });
  return {
    lemon: tone(c.lemon, c.onPastel, c.onPastel),
    loud: tone(s.loud, s.loud, s.onLoud),
    paper: tone(c.paper, s.keyEdge, c.ink),
  } satisfies Record<KeyTone, unknown>;
}

const styles = StyleSheet.create((theme) => ({
  key: { minWidth: theme.shape.touchMin },
  plate: { position: 'absolute', top: KEY_DROP, left: 0, right: 0 },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.shape.keyBorder,
  },
  iconOnly: { paddingHorizontal: 0 },
  labelled: { paddingHorizontal: 18 },
  label: { fontFamily: FONT.numerals },
}));
