import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { useMotionPolicy } from '@/motion/policy';
import { EASE_CSS } from '@/motion/tokens';
import { FONT } from '@/theme/type';

import type { IconName } from './key';
import { cssMs } from './motion-level';

export type SegmentOption<T extends string> = {
  readonly id: T;
  readonly label: string;
  readonly icon?: IconName;
};

type SegmentedProps<T extends string> = {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  /** Fires on press. The caller owns the haptic. */
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
};

const SLIDE_MS = 200;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>): ReactNode {
  const level = useMotionPolicy();
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
    >
      <View style={styles.lane}>
        <Animated.View
          testID="segmented-pill"
          style={[
            styles.pill,
            {
              width: `${100 / options.length}%`,
              transform: [{ translateX: `${index * 100}%` }],
              transitionProperty: 'transform',
              transitionDuration: cssMs(level, SLIDE_MS),
              transitionTimingFunction: EASE_CSS.out,
            },
          ]}
        />
        {options.map((o, i) => {
          const selected = i === index;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (!selected) onChange(o.id);
              }}
              style={styles.segment}
            >
              {o.icon !== undefined && (
                <MaterialCommunityIcons name={o.icon} size={16} style={styles.ink(selected)} />
              )}
              <Text style={[styles.label, styles.ink(selected)]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.chip,
  },
  lane: { flexDirection: 'row' },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    backgroundColor: theme.colors.ink,
  },
  segment: {
    flex: 1,
    height: theme.shape.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { fontFamily: FONT.numerals, fontSize: 16 },
  ink: (selected: boolean) => ({ color: selected ? theme.colors.canvas : theme.colors.ink }),
}));
