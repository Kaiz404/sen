import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { type } from '@/theme/type';

type StampProps = {
  /** The small line above the word, such as "ADDED BY". */
  readonly caption: string;
  readonly word: string;
  /** Already formatted, as the boards print it: `15·10·26`. */
  readonly date: string;
  /** Omit when the stamp repeats something the screen already says. */
  readonly accessibilityLabel?: string;
};

/** A round rubber stamp: outlined, never filled, set at a slant. */
export function Stamp({ caption, word, date, accessibilityLabel }: StampProps): ReactNode {
  const spoken = accessibilityLabel !== undefined;
  return (
    <View
      accessible={spoken}
      accessibilityRole={spoken ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!spoken}
      style={styles.stamp}
    >
      <Text style={[styles.small, styles.caption]}>{caption}</Text>
      <Text style={styles.word}>{word}</Text>
      <Text style={styles.small}>{date}</Text>
    </View>
  );
}

const SIZE = 92;

const styles = StyleSheet.create((theme) => ({
  stamp: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 8.5,
    borderColor: theme.colors.stamp,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
    transform: [{ rotate: '-11deg' }],
  },
  small: { ...type.mono(9, 600), color: theme.colors.stamp },
  caption: { letterSpacing: 1.26 },
  word: {
    ...type.words(24),
    lineHeight: 24,
    color: theme.colors.stamp,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.stamp,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginVertical: 3,
  },
}));
