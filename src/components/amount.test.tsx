import { render, screen } from '@testing-library/react-native';

import { signedMinor } from '@/models/money';

import { Amount } from './amount';

test('a masked amount shows four coins and no digits, and reads as "Amount hidden"', async () => {
  await render(<Amount value={null} size="row" />);

  const amount = screen.getByLabelText('Amount hidden');
  expect(amount).toHaveTextContent('RM');
  expect(screen.queryByText(/\d/)).toBeNull();
});

test('a masked hero can show the direction without the digits', async () => {
  await render(<Amount value={null} size="hero" direction="debit" />);

  expect(screen.getByLabelText('Amount hidden')).toHaveTextContent('−RM');
});

test('a revealed debit splits the sen digits and speaks the amount in words', async () => {
  await render(<Amount value={signedMinor(-4250)} size="row" />);

  const amount = screen.getByLabelText('Minus 42 ringgit 50');
  expect(amount).toHaveTextContent('−RM 42.50');
  expect(screen.getByText('.50')).toBeOnTheScreen();
});

test('a revealed hero sets the currency apart from the digits', async () => {
  await render(<Amount value={signedMinor(231740)} size="hero" />);

  expect(screen.getByText('+RM')).toBeOnTheScreen();
  expect(screen.getByLabelText('Plus 2317 ringgit 40')).toHaveTextContent('+RM2,317.40');
});
