import '@shopify/flash-list/jestSetup';

import { render, screen } from '@testing-library/react-native';

import { HISTORY_STATES } from './fixtures';

test('a search shortens the header to the month and "SAVINGS ·· 4821" on one line', async () => {
  await render(HISTORY_STATES.search());

  expect(screen.getByText('SAVINGS ·· 4821')).toBeOnTheScreen();
  expect(screen.queryByText('EVERYDAY SAVINGS ·· 4821')).not.toBeOnTheScreen();
  expect(screen.queryByText(/so far/)).not.toBeOnTheScreen();
});

test('the In filter puts its count and what it hides on one plate', async () => {
  await render(HISTORY_STATES['in-filter']());

  expect(screen.getByText(/^\d+ payments? in$/)).toBeOnTheScreen();
  expect(screen.getByText('OUT HIDDEN BY FILTER')).toBeOnTheScreen();
});

test('the Add key is named for screen readers and the header has no Add word', async () => {
  await render(HISTORY_STATES.masked());

  expect(screen.getByRole('button', { name: 'Add a transaction' })).toBeOnTheScreen();
  expect(screen.queryByText('Add')).not.toBeOnTheScreen();
});

test('the full error leaves the Add key out', async () => {
  await render(HISTORY_STATES.failed());

  expect(screen.queryByRole('button', { name: 'Add a transaction' })).not.toBeOnTheScreen();
});
