import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  type Direction,
  MINUS,
  moneyParts,
  moneySpoken,
  type SignedMinor,
  type SignMode,
} from '@/models/money';
import { type, type TypeRole } from '@/theme/type';

import { standIn } from './stand-in';

export type AmountSize = 'hero' | 'card' | 'row' | 'net';
/** What the amount sits on: canvas or paper, a pastel card, or the loud fill. */
export type AmountSurface = 'plain' | 'pastel' | 'loud';

type Face = 'words' | 'numerals' | 'mono';

type Scale = {
  /** `null` sets the currency inline in the whole-number text, at its size. */
  readonly currency: { readonly face: Face; readonly size: number } | null;
  readonly face: Face;
  readonly whole: number;
  /** Equal to `whole` means the sen digits are not split. */
  readonly fraction: number;
  readonly masked: { readonly face: Face; readonly size: number };
  readonly coin: number;
  readonly coinEdge: number;
  readonly coinGap: number;
};

/** Sizes as the boards draw them: SF-Reveal and SF-Detail heroes, the month card, rows and day nets. */
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
  },
};

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
  /** Masked only. Shows the sign, so a hero can read `−RM` and coins. */
  readonly direction?: Direction;
};

export function Amount({
  value,
  size,
  surface = 'plain',
  sign = 'auto',
  direction,
}: AmountProps): ReactNode {
  const scale = SCALE[size];

  if (value === null) {
    const mark = sign === 'never' || direction === undefined ? '' : direction === 'credit' ? '+' : MINUS;
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel="Amount hidden"
        style={[styles.row, { gap: scale.coinGap }]}
      >
        <Text
          style={[
            FACE[scale.masked.face](scale.masked.size),
            styles.ink(surface, direction === 'credit'),
            styles.maskedCurrency,
          ]}
        >
          {`${mark}RM`}
        </Text>
        <View style={[styles.row, { gap: scale.coinGap }]}>
          {COINS.map((i) => (
            <View
              key={i}
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

  const parts = moneyParts(value, sign);
  const ink = styles.ink(surface, value > 0);
  const split = scale.fraction !== scale.whole;
  const digits = (
    <Text style={[FACE[scale.face](scale.whole), ink]}>
      {scale.currency === null && `${parts.sign}${parts.currency}${THIN_SPACE}`}
      {parts.whole}
      {split ? (
        <Text style={[FACE[scale.face](scale.fraction), styles.fraction]}>{parts.fraction}</Text>
      ) : (
        parts.fraction
      )}
    </Text>
  );

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={moneySpoken(value, sign)}
      style={[styles.row, styles.baseline]}
    >
      {scale.currency !== null && (
        <Text style={[FACE[scale.currency.face](scale.currency.size), ink, styles.heroCurrency]}>
          {`${parts.sign}${parts.currency}`}
        </Text>
      )}
      {digits}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  baseline: { alignItems: 'baseline' },
  ink: (surface: AmountSurface, credit: boolean) => ({
    color:
      surface === 'loud'
        ? standIn(theme.colors, rt.themeName).onLoud
        : surface === 'pastel'
          ? theme.colors.onPastel
          : credit
            ? theme.colors.deep
            : theme.colors.ink,
  }),
  maskedCurrency: { marginRight: 2 },
  heroCurrency: { marginRight: 6 },
  fraction: { letterSpacing: 0 },
  coin: { backgroundColor: theme.colors.lemon, borderColor: theme.colors.onPastel },
}));
