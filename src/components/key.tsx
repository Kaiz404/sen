import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useMotionPolicy } from '@/motion/policy';
import { DUR, EASE_CSS } from '@/motion/tokens';
import { dark, type Palette } from '@/theme/colors';
import { FONT } from '@/theme/type';

import { cssMs } from './motion-level';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type KeyTone = 'lemon' | 'loud' | 'paper' | 'outline';
export type KeySize = 'regular' | 'medium' | 'large' | 'xlarge';
export type KeySurface = 'plain' | 'hero';

type KeyProps = {
  readonly onPress: () => void;
  readonly tone?: KeyTone;
  readonly size?: KeySize;
  readonly surface?: KeySurface;
  readonly disabled?: boolean;
  readonly testID?: string;
} & (
  | {
      readonly label: string;
      readonly icon?: IconName;
      readonly iconPosition?: 'start' | 'end';
      readonly accessibilityLabel?: string;
    }
  | {
      readonly label?: undefined;
      readonly icon: IconName;
      readonly iconPosition?: undefined;
      readonly accessibilityLabel: string;
    }
);

const SIZE = {
  regular: { height: 46, radius: 15, font: 17, icon: 21, gap: 4 },
  medium: { height: 52, radius: 18, font: 17, icon: 20, gap: 8 },
  large: { height: 56, radius: 18, font: 18, icon: 22, gap: 10 },
  xlarge: { height: 60, radius: 20, font: 19, icon: 24, gap: 10 },
} as const satisfies Record<KeySize, unknown>;

const KEY_DROP = 4;

export function Key({
  onPress,
  tone = 'paper',
  size = 'regular',
  surface = 'plain',
  disabled = false,
  testID,
  label,
  icon,
  iconPosition = 'start',
  accessibilityLabel,
}: KeyProps): ReactNode {
  const [pressed, setPressed] = useState(false);
  const level = useMotionPolicy();
  const s = SIZE[size];
  const iconOnly = label === undefined;
  const { theme } = useUnistyles();
  const palette = surface === 'hero' ? dark : theme.colors;
  const c = keyColors(palette, disabled)[tone];
  const glyph = icon !== undefined && (
    <MaterialCommunityIcons name={icon} size={s.icon} color={c.ink} />
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
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
          { backgroundColor: c.face, borderColor: c.edge, borderStyle: c.edgeStyle },
          iconOnly ? styles.iconOnly : styles.labelled,
          {
            transform: [{ translateY: pressed ? KEY_DROP : 0 }],
            transitionProperty: 'transform',
            transitionDuration: cssMs(level, DUR.press),
            transitionTimingFunction: EASE_CSS.out,
          },
        ]}
      >
        {disabled && c.washed && (
          <View
            style={[
              styles.wash,
              { borderRadius: s.radius - theme.shape.keyBorder, backgroundColor: palette.canvas },
            ]}
          />
        )}
        {iconPosition === 'start' && glyph}
        {label !== undefined && (
          <Text style={[styles.label, { fontSize: s.font, color: c.ink }]}>{label}</Text>
        )}
        {iconPosition === 'end' && glyph}
      </Animated.View>
    </Pressable>
  );
}

function keyColors(c: Palette, disabled: boolean) {
  const filled = (face: string, edge: string, ink: string, plate: string = c.keyPlate) => ({
    face,
    edge,
    ink,
    plate,
    edgeStyle: 'solid' as const,
    washed: true,
  });
  const outline = disabled ? c.inkMuted : c.ink;
  return {
    lemon: filled(c.lemon, c.lemonEdge, c.onPastel, c.lemonPlate),
    loud: filled(c.loud, c.loud, c.onLoud),
    paper: filled(c.paper, c.keyEdge, c.ink),
    outline: {
      face: 'transparent',
      edge: outline,
      ink: outline,
      plate: 'transparent',
      edgeStyle: disabled ? ('dashed' as const) : ('solid' as const),
      washed: false,
    },
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
  wash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.5 },
}));
