import { KeyUnreadableError, storeCauseOf } from './store-fault';

test.each([
  ['SQLITE_FULL', new Error('Error code 13: database or disk is full'), 'full'],
  ['Android out of space', new Error('write failed: No space left on device'), 'full'],
  ['an unreadable key', new KeyUnreadableError({ cause: new Error('x') }), 'key'],
  ['a failed migration', new Error('migration 2 failed'), 'store'],
  ['a non-error throw', 'boom', 'store'],
])('%s reads as %s', (_, error, cause) => {
  expect(storeCauseOf(error)).toBe(cause);
});
