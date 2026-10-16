import * as LocalAuthentication from 'expo-local-authentication';

import { authenticate } from './prompt';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));

const authenticateAsync = jest.mocked(LocalAuthentication.authenticateAsync);

test.each([
  ['a known code', 'lockout', { ok: false, reason: 'lockout' }],
  [
    'an iOS code outside the typed union',
    'unknown: -1004, Not interactive',
    { ok: false, reason: 'unknown' },
  ],
  ['a missing usage description', 'missing_usage_description', { ok: false, reason: 'unknown' }],
  ['a name on Object.prototype', 'toString', { ok: false, reason: 'unknown' }],
])('%s maps to its failure', async (_, error, expected) => {
  authenticateAsync.mockResolvedValueOnce({
    success: false,
    error: error as LocalAuthentication.LocalAuthenticationError,
  });

  expect(await authenticate('Unlock Sen')).toEqual(expected);
});
