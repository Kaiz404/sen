import { render, screen } from '@testing-library/react-native';

import { deleteDb } from '@/services/db';

import { DbSmoke } from './db-smoke';

jest.mock('expo-crypto', () => ({ getRandomValues: (bytes: Uint8Array) => bytes.fill(171) }));
jest.mock('@/services/db', () => {
  const { openTestDb } = jest.requireActual('@/services/db/testing/node-adapter');
  return {
    ...jest.requireActual('@/services/db'),
    openDb: jest.fn(() => openTestDb()),
    deleteDb: jest.fn(async () => undefined),
  };
});

test('the smoke migrates, reads the Malaysia day of 16:30Z back, then deletes its file', async () => {
  await render(<DbSmoke />);

  expect(await screen.findByText('day 2026-10-16')).toBeOnTheScreen();
  expect(screen.getByTestId('smoke-version')).toHaveTextContent('user_version 2');
  expect(screen.getByTestId('smoke-cipher')).toHaveTextContent('cipher_version none');
  expect(jest.mocked(deleteDb).mock.calls).toEqual([['sen-smoke.db'], ['sen-smoke.db']]);
});
