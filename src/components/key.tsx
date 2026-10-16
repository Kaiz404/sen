import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { useMotionPolicy } from '@/motion/policy';
import { DUR, EASE_CSS } from '@/motion/tokens';
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.key, { height: s.height + KEY_DROP }, iconOnly && { width: s.height }]}
    >
      <View style={[styles.plate, { height: s.height, borderRadius: s.radius }]} />
      <Animated.View
        testID="key-face"
        style={[
          styles.face(tone),
          { height: s.height, borderRadius: s.radius, gap: s.gap },
          iconOnly ? styles.iconOnly : styles.labelled,
          {
            transform: [{ translateY: pressed ? KEY_DROP : 0 }],
            transitionProperty: 'transform',
            transitionDuration: cssMs(level, DUR.press),
            transitionTimingFunction: EASE_CSS.out,
          },
        ]}
      >
        {icon !== undefined && (
          <MaterialCommunityIcons name={icon} size={s.icon} style={styles.ink(tone)} />
        )}
        {label !== undefined && (
          <Text style={[styles.label, styles.ink(tone), { fontSize: s.font }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme, rt) => {
  const c = theme.colors;
  const s = standIn(c, rt.themeName);
  const face: Record<KeyTone, string> = { lemon: c.lemon, loud: s.loud, paper: c.paper };
  const edge: Record<KeyTone, string> = { lemon: c.onPastel, loud: s.loud, paper: s.keyEdge };
  const ink: Record<KeyTone, string> = { lemon: c.onPastel, loud: s.onLoud, paper: c.ink };
  return {
    key: { minWidth: theme.shape.touchMin },
    plate: {
      position: 'absolute',
      top: KEY_DROP,
      left: 0,
      right: 0,
      backgroundColor: s.keyPlate,
    },
    face: (tone: KeyTone) => ({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.shape.keyBorder,
      backgroundColor: face[tone],
      borderColor: edge[tone],
    }),
    iconOnly: { paddingHorizontal: 0 },
    labelled: { paddingHorizontal: 18 },
    ink: (tone: KeyTone) => ({ color: ink[tone] }),
    label: { fontFamily: FONT.numerals },
  };
});
