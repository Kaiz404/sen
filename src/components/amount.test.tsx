import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { signedMinor } from '@/models/money';

import { type } from '@/theme/type';

import { Amount, heroEaseMs, heroFactor } from './amount';

test('a masked amount shows four coins and no digits, and reads as "Amount hidden"', async () => {
  await render(<Amount value={null} size="row" />);

  const amount = screen.getByLabelText('Amount hidden');
  expect(amount).toHaveTextContent('RM');
  expect(screen.queryByText(/\d/)).toBeNull();
  expect(screen.getAllByTestId('amount-coin')).toHaveLength(4);
});

test('a masked hero can show the direction without the digits', async () => {
  await render(<Amount value={null} size="hero" direction="debit" />);

  expect(screen.getByLabelText('Amount hidden')).toHaveTextContent('−RM');
});

test('a revealed debit splits the sen digits and speaks the amount in words', async () => {
  await render(<Amount value={signedMinor(-4250)} size="row" />);

  const amount = screen.getByLabelText('Minus 42 ringgit 50 sen');
  expect(amount).toHaveTextContent('−RM 42.50');
  expect(screen.getByText('.50')).toBeOnTheScreen();
});

test('a revealed hero sets the currency apart from the digits', async () => {
  await render(<Amount value={signedMinor(231740)} size="hero" />);

  expect(screen.getByText('+RM')).toBeOnTheScreen();
  expect(screen.getByLabelText('Plus 2317 ringgit 40 sen')).toHaveTextContent('+RM2,317.40');
});

test.each([
  ['0.04', 1],
  ['142.60', 1],
  ['2,317.40', 0.66],
  ['50,000.00', 0.54],
  ['99,999.99', 0.54],
])('the hero steps its size down by length: %s takes factor %s', (digits, factor) => {
  expect(heroFactor(digits.length)).toBe(factor);
});

type Glyph = { index: number; advanceWidth?: number };
type Font = {
  unitsPerEm: number;
  charToGlyph: (ch: string) => Glyph;
  glyphs: { get: (i: number) => Glyph };
  substitution: { getSingle: (f: string, s: string, l: string) => { sub: number; by: number }[] };
};
// opentype.js ships no types; this reads font files in a test only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const opentype = require('opentype.js') as {
  parse: (b: ArrayBuffer) => Font;
};

describe('the hero fits 360 dp beside Sen, measured from the shipped fonts', () => {
  const dir = join(__dirname, '../../assets/fonts/');
  const load = (file: string) => {
    const buf = readFileSync(dir + file);
    return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  };
  const numerals = load('BricolageGrotesque-ExtraBold.ttf');
  const words = load('BricolageGrotesque96ptCondensed-ExtraBold.ttf');
  const tabular = new Map(
    (numerals.substitution.getSingle('tnum', 'latn', 'dflt') ?? []).map((s) => [s.sub, s.by]),
  );
  const advance = (font: Font, ch: string, tnum: boolean) => {
    let g = font.charToGlyph(ch);
    const by = tnum ? tabular.get(g.index) : undefined;
    if (by !== undefined) g = font.glyphs.get(by);
    return g.advanceWidth! / font.unitsPerEm;
  };

  /** Laid-out width in dp: whole part with the numerals tracking, the fraction untracked, then "RM" at its own size. */
  function heroWidth(text: string, currencyScale = 1): number {
    const [whole = '', fraction = ''] = text.split('.');
    const f = heroFactor(text.length);
    const wholeSize = Math.round(96 * f);
    const fractionSize = Math.round(40 * f);
    const currencySize = Math.round(30 * f) * currencyScale;
    const tracking = type.numerals(wholeSize).letterSpacing!;
    const digits = [...whole].reduce((n, c) => n + advance(numerals, c, true) * wholeSize + tracking, 0);
    const tail = [...`.${fraction}`].reduce((n, c) => n + advance(numerals, c, true) * fractionSize, 0);
    const rm = (advance(words, 'R', false) + advance(words, 'M', false)) * currencySize + 6;
    return digits + tail + rm;
  }

  const BUDGET = 360 - 40 - 32;
  test.each(['999.99', '9,999.99', '99,999.99'])(
    'the worst case of its tier, %s, fits with RM at the 1.3 font-scale cap',
    (text) => {
      expect(heroWidth(text, 1.3)).toBeLessThanOrEqual(BUDGET);
    },
  );

  test('the widest tier still has room, so the table is not tighter than it needs to be', () => {
    expect(heroWidth('99,999.99', 1.3)).toBeGreaterThan(BUDGET * 0.6);
  });
});

test('a revealed hero draws the longest amount in the smallest tier and never grows with the font scale', async () => {
  await render(<Amount value={signedMinor(9_999_999)} size="hero" sign="never" />);

  const digits = screen.getByText('99,999', { exact: false });
  expect(digits).toHaveStyle({ fontSize: 52 });
  expect(digits.props.maxFontSizeMultiplier).toBe(1);
  expect(digits.props.numberOfLines).toBe(1);
});

test('the hero eases growth but shrinks at once, so a longer figure never draws wide for a frame', async () => {
  const { rerender } = await render(<Amount value={signedMinor(14260)} size="hero" sign="never" />);
  const style = () => StyleSheet.flatten(screen.getByText(/^(142|2,317)/).props.style);
  expect(style().fontSize).toBe(96);

  await rerender(<Amount value={signedMinor(231740)} size="hero" sign="never" />);
  expect(style().fontSize).toBe(63);

  await rerender(<Amount value={signedMinor(14260)} size="hero" sign="never" />);
  expect(style().fontSize).toBe(96);
});

test('only growth eases, and only in Full motion', () => {
  expect(heroEaseMs('full', true)).toBe(160);
  expect(heroEaseMs('full', false)).toBe(0);
  expect(heroEaseMs('calm', true)).toBe(0);
});
