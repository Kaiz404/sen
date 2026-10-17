import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type } from '@/theme/type';

type StampProps = {
  readonly caption: string;
  readonly word: string;
  readonly date: string;
  readonly accessibilityLabel?: string;
};

export function Stamp({ caption, word, date, accessibilityLabel }: StampProps): ReactNode {
  const spoken = accessibilityLabel !== undefined;
  const ink = { color: useUnistyles().theme.colors.stamp };
  return (
    <View
      accessible={spoken}
      accessibilityRole={spoken ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!spoken}
      style={styles.stamp}
    >
      <View style={styles.innerRing} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.small, styles.caption, ink]}>
        {caption}
      </Text>
      <View style={styles.rules}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.word, ink]}>
          {word}
        </Text>
      </View>
      <Text style={[styles.small, ink]}>{date}</Text>
    </View>
  );
}

const SIZE = 92;

const styles = StyleSheet.create((theme) => ({
  stamp: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: theme.colors.stamp,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
    transform: [{ rotate: '-11deg' }],
  },
  innerRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: theme.colors.stamp,
  },
  small: type.mono(9, 600),
  caption: { letterSpacing: 0.9, maxWidth: 60 },
  rules: {
    maxWidth: 74,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginVertical: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.stamp,
  },
  word: { ...type.words(24), lineHeight: 22 },
}));
