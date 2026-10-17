import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  type Direction,
  MINUS,
  moneyParts,
  moneySpoken,
  type SignedMinor,
  type SignMode,
} from '@/models/money';
import { type MotionLevel, useMotionPolicy } from '@/motion/policy';
import { EASE_CSS } from '@/motion/tokens';
import type { Palette } from '@/theme/colors';
import { type, type TypeRole } from '@/theme/type';

import { cssMs } from './motion-level';

export type AmountSize = 'hero' | 'card' | 'row' | 'net' | 'tile';
export type AmountSurface = 'plain' | 'pastel' | 'plate' | 'loud';

/** The ink an amount takes on the surface behind it. `plate` is the paper plate on a pastel card, in both modes. */
export function amountInk(c: Palette, surface: AmountSurface, credit: boolean): string {
  switch (surface) {
    case 'loud':
      return c.onLoud;
    case 'pastel':
      return c.onPastel;
    case 'plate':
      return credit ? c.plateCredit : c.onPastel;
    case 'plain':
      return credit ? c.deep : c.ink;
  }
}

type Face = 'words' | 'numerals' | 'mono';

type Scale = {
  readonly currency: { readonly face: Face; readonly size: number } | null;
  readonly face: Face;
  readonly whole: number;
  readonly fraction: number;
  readonly masked: { readonly face: Face; readonly size: number };
  readonly coin: number;
  readonly coinEdge: number;
  readonly coinGap: number;
  readonly stacked: boolean;
};

const SCALE: Readonly<Record<AmountSize, Scale>> = {
  hero: {
    currency: { face: 'words', size: 30 },
    face: 'numerals',
    whole: 96,
    fraction: 40,
    masked: { face: 'words', size: 30 },
    coin: 40,
    coinEdge: 2.5,
    coinGap: 8,
    stacked: false,
  },
  card: {
    currency: null,
    face: 'numerals',
    whole: 26,
    fraction: 16,
    masked: { face: 'numerals', size: 20 },
    coin: 12,
    coinEdge: 1.5,
    coinGap: 4,
    stacked: false,
  },
  row: {
    currency: null,
    face: 'numerals',
    whole: 19,
    fraction: 13,
    masked: { face: 'numerals', size: 15 },
    coin: 9,
    coinEdge: 1.5,
    coinGap: 3,
    stacked: false,
  },
  net: {
    currency: null,
    face: 'mono',
    whole: 13,
    fraction: 13,
    masked: { face: 'mono', size: 12 },
    coin: 8,
    coinEdge: 1.5,
    coinGap: 3,
    stacked: false,
  },
  tile: {
    currency: null,
    face: 'numerals',
    whole: 11,
    fraction: 11,
    masked: { face: 'numerals', size: 11 },
    coin: 7,
    coinEdge: 1.5,
    coinGap: 2,
    stacked: true,
  },
};

/**
 * The hero steps down by how many characters the digits take (whole part with its commas, plus the fraction), so
 * the biggest amount still fits one line beside Sen at 360 dp. The Add keypad stops at 7 digits, so the longest
 * is "99,999.99" (9). Lengths of 7 never occur: a whole part is 1-3 digits (4-6 chars) or has a comma (8-9).
 * Checked against the 360 dp budget at the tier's size in amount.test.tsx.
 */
export const HERO_TIERS: readonly { readonly upTo: number; readonly factor: number }[] = [
  { upTo: 6, factor: 1 },
  { upTo: 8, factor: 0.66 },
  { upTo: Infinity, factor: 0.54 },
];
const HERO_GROW_MS = 160;

/** Growth eases and shrinking is instant, so a longer figure never draws wide for a frame. */
export function heroEaseMs(level: MotionLevel, grew: boolean): number {
  return cssMs(level, grew ? HERO_GROW_MS : 0);
}

export function heroFactor(digitChars: number): number {
  return (HERO_TIERS.find((t) => digitChars <= t.upTo) ?? HERO_TIERS[HERO_TIERS.length - 1]!).factor;
}

const FACE: Readonly<Record<Face, (size: number) => TypeRole>> = {
  words: (size) => ({ ...type.words(size), letterSpacing: 0 }),
  numerals: type.numerals,
  mono: (size) => type.mono(size, 600),
};

const THIN_SPACE = ' ';
const COINS = [0, 1, 2, 3] as const;

type AmountProps = {
  /** `null` is masked: always four coins, never the real digit count. */
  readonly value: SignedMinor | null;
  readonly size: AmountSize;
  readonly surface?: AmountSurface;
  readonly sign?: SignMode;
  readonly direction?: Direction;
};

export function Amount({
  value,
  size,
  surface = 'plain',
  sign = 'auto',
  direction,
}: AmountProps): ReactNode {
  const level = useMotionPolicy();
  const { theme } = useUnistyles();
  const scale = SCALE[size];
  const hero = size === 'hero';
  const parts = value === null ? null : moneyParts(value, sign);
  const f = hero && parts !== null ? heroFactor(parts.whole.length + parts.fraction.length) : 1;
  const [tier, setTier] = useState({ f, grew: false });
  if (tier.f !== f) setTier({ f, grew: f > tier.f });

  if (value === null) {
    const mark =
      sign === 'never' || direction === undefined ? '' : direction === 'credit' ? '+' : MINUS;
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel="Amount hidden"
        style={[scale.stacked ? styles.stack : styles.row, { gap: scale.coinGap }]}
      >
        <Text
          style={[
            FACE[scale.masked.face](scale.masked.size),
            { color: amountInk(theme.colors, surface, direction === 'credit') },
            !scale.stacked && styles.maskedCurrency,
          ]}
        >
          {`${mark}RM`}
        </Text>
        <View style={[styles.row, { gap: scale.coinGap }]}>
          {COINS.map((i) => (
            <View
              key={i}
              testID="amount-coin"
              style={[
                styles.coin,
                {
                  width: scale.coin,
                  height: scale.coin,
                  borderRadius: scale.coin / 2,
                  borderWidth: scale.coinEdge,
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (parts === null) return null;
  const ink = { color: amountInk(theme.colors, surface, value > 0) };
  const split = scale.fraction !== scale.whole;
  const wholeSize = Math.round(scale.whole * f);
  const fractionSize = Math.round(scale.fraction * f);
  const fade = hero
    ? {
        transitionProperty: 'fontSize' as const,
        transitionDuration: heroEaseMs(level, tier.grew),
        transitionTimingFunction: EASE_CSS.out,
      }
    : undefined;
  const Digits = hero ? Animated.Text : Text;
  const digits = (
    <Digits
      numberOfLines={1}
      adjustsFontSizeToFit
      // Display type is already large, so the system font scale doesn't grow it past its tier.
      maxFontSizeMultiplier={hero ? 1 : undefined}
      style={[FACE[scale.face](wholeSize), ink, styles.shrink, fade]}
    >
      {scale.currency === null && `${parts.sign}${parts.currency}${THIN_SPACE}`}
      {parts.whole}
      {split ? (
        <Digits style={[FACE[scale.face](fractionSize), styles.fraction, fade]}>{parts.fraction}</Digits>
      ) : (
        parts.fraction
      )}
    </Digits>
  );
  const Currency = hero ? Animated.Text : Text;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={moneySpoken(value, sign)}
      style={[styles.row, styles.baseline]}
    >
      {scale.currency !== null && (
        <Currency
          maxFontSizeMultiplier={1.3}
          style={[
            FACE[scale.currency.face](Math.round(scale.currency.size * f)),
            ink,
            styles.heroCurrency,
            fade,
          ]}
        >
          {`${parts.sign}${parts.currency}`}
        </Currency>
      )}
      {digits}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  stack: { alignItems: 'center' },
  baseline: { alignItems: 'baseline' },
  maskedCurrency: { marginRight: 2 },
  heroCurrency: { marginRight: 6 },
  fraction: { letterSpacing: 0 },
  shrink: { flexShrink: 1 },
  coin: { backgroundColor: theme.colors.lemon, borderColor: theme.colors.onPastel },
}));
