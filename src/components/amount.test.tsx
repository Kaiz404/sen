import { render, screen } from '@testing-library/react-native';

import { signedMinor } from '@/models/money';

import { Amount, heroFactor } from './amount';

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

test('the longest hero amount, RM 99,999.99, fits the 360 dp box beside Sen in one line', () => {
  // Bricolage numerals are about 0.58 em wide, a comma or point 0.3 em, and the fraction runs at 0.46 of the whole.
  const budget = 360 - 40 - 32;
  const width = (text: string) => {
    const [whole = '', fraction = ''] = text.split('.');
    const em = (t: string) => [...t].reduce((n, c) => n + (c === ',' ? 0.3 : 0.58), 0);
    const f = heroFactor(text.length);
    return 96 * f * em(whole) + 40 * f * (em(fraction) + 0.3) + 30 * f * 1.4 + 6;
  };
  for (const text of ['99,999.99', '50,000.00', '2,317.40', '142.60']) {
    expect(width(text)).toBeLessThanOrEqual(budget);
  }
});

test('a revealed hero draws the longest amount in the smallest tier and never grows with the font scale', async () => {
  await render(<Amount value={signedMinor(9_999_999)} size="hero" sign="never" />);

  const digits = screen.getByText('99,999', { exact: false });
  expect(digits).toHaveStyle({ fontSize: 52 });
  expect(digits.props.maxFontSizeMultiplier).toBe(1);
  expect(digits.props.numberOfLines).toBe(1);
});
