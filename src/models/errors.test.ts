import { isAppError, isRetryable } from './errors';

test('isAppError accepts tagged errors and rejects bugs', () => {
  expect(isAppError({ kind: 'invalid_data', skipped: 2 })).toBe(true);
  expect(isAppError({ kind: 'db_reset', reason: 'corrupt' })).toBe(true);
  expect(isAppError(new Error('boom'))).toBe(false);
  expect(isAppError({ kind: 'invalid_data' })).toBe(false);
  expect(isAppError({ kind: 'nope' })).toBe(false);
});

test('only transport errors retry', () => {
  expect(isRetryable({ kind: 'timeout' })).toBe(true);
  expect(isRetryable({ kind: 'invalid_data', skipped: 1 })).toBe(false);
});
