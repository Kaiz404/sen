import { isAppError, isRetryable, toAppError } from './errors';

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

test('toAppError keeps a tagged error', () => {
  expect(toAppError({ kind: 'offline' })).toEqual({ kind: 'offline' });
  expect(isRetryable({ kind: 'storage' })).toBe(false);
  expect(isRetryable({ kind: 'unknown' })).toBe(false);
});

test.each([
  ['expo-sqlite full', new Error('Error code 13: database or disk is full')],
  ['expo-sqlite io', new Error('Error code 10: disk I/O error')],
  ['an extended io code', Object.assign(new Error('x'), { errcode: 10 | (6 << 8) })],
  ['a node code', Object.assign(new Error('x'), { code: 'ENOSPC' })],
  ['a code name', Object.assign(new Error('x'), { code: 'SQLITE_IOERR_WRITE' })],
])('toAppError calls %s a storage failure', (_name, thrown) => {
  expect(toAppError(thrown)).toEqual({ kind: 'storage' });
});

test.each([
  ['a type error', new TypeError("Cannot read properties of undefined (reading 'x')")],
  ['a locked database', new Error('Error code 5: database is locked')],
  ['a bare string', 'boom'],
  ['nothing', undefined],
])('toAppError calls %s unknown, not storage', (_name, thrown) => {
  expect(toAppError(thrown)).toEqual({ kind: 'unknown' });
});
