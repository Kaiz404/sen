import { Platform, type TextStyle } from 'react-native';

/**
 * Family names as the expo-font plugin registers them in app.config.ts. Android resolves the declared family
 * plus `fontWeight`. iOS resolves each file's PostScript name (inferred, checked on the first iOS build).
 */
export const FONT = Platform.select({
  ios: {
    words: 'BricolageGrotesque96ptCondensed-ExtraBold',
    numerals: 'BricolageGrotesque-ExtraBold',
    mono500: 'IBMPlexMono-Medium',
    mono600: 'IBMPlexMono-SemiBold',
  },
  default: {
    words: 'BricolageGrotesque96ptCondensed-ExtraBold',
    numerals: 'BricolageGrotesque-ExtraBold',
    mono500: 'IBMPlexMono',
    mono600: 'IBMPlexMono',
  },
});

/** Narrower than TextStyle: Unistyles rejects a spread of the full TextStyle (its `cursor` is wider than Unistyles allows). */
export type TypeRole = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'textTransform' | 'fontVariant'
>;

const em = (value: number, size: number) => Math.round(value * size * 100) / 100;

export const type = {
  words: (size: number): TypeRole => ({
    fontFamily: FONT.words,
    fontSize: size,
    letterSpacing: em(-0.005, size),
    textTransform: 'uppercase',
  }),
  numerals: (size: number): TypeRole => ({
    fontFamily: FONT.numerals,
    fontSize: size,
    letterSpacing: em(-0.035, size),
    fontVariant: ['tabular-nums', 'lining-nums'],
  }),
  mono: (size: number, weight: 500 | 600 = 500): TypeRole => ({
    fontFamily: weight === 500 ? FONT.mono500 : FONT.mono600,
    fontWeight: weight === 500 ? '500' : '600',
    fontSize: size,
  }),
  caption: (size = 11): TypeRole => ({
    ...type.mono(size, 600),
    letterSpacing: em(0.12, size),
    textTransform: 'uppercase',
  }),
  body: (size: number): TypeRole => ({ fontSize: size }),
} as const;

export const FRACTION_SCALE = 0.46;
