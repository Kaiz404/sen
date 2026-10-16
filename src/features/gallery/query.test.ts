import { parseQuery, parseTheme } from './query';

const screens = { key: { lemon: () => null, paper: () => null } };

test.each([
  [{}, { kind: 'index' }],
  [{ screen: 'db' }, { kind: 'db' }],
  [{ screen: 'sen' }, { kind: 'poses' }],
  [
    { screen: 'sen', pose: 'worried', size: '72' },
    { kind: 'pose', pose: 'worried', size: 72 },
  ],
  [
    { screen: 'sen', pose: 'asleep' },
    { kind: 'pose', pose: 'asleep', size: 200 },
  ],
  [
    { screen: 'sen', pose: 'grumpy' },
    { kind: 'unknown', reason: 'No pose "grumpy".' },
  ],
  [
    { screen: 'sen', pose: 'idle', size: 'big' },
    { kind: 'unknown', reason: 'Size must be a positive number of pt.' },
  ],
  [
    { screen: 'key', state: 'paper' },
    { kind: 'state', screen: 'key', state: 'paper' },
  ],
  [
    { screen: 'key', state: 'gold' },
    { kind: 'unknown', reason: 'Screen "key" has states: lemon, paper.' },
  ],
  [{ screen: 'history' }, { kind: 'unknown', reason: 'No screen "history".' }],
])('%j reads as %j', (params, query) => {
  expect(parseQuery(params, screens)).toEqual(query);
});

test('theme=dark and theme=light force a theme, anything else follows the system', () => {
  expect(parseTheme({ theme: 'dark' })).toBe('dark');
  expect(parseTheme({ theme: 'light' })).toBe('light');
  expect(parseTheme({ theme: 'sepia' })).toBeUndefined();
  expect(parseTheme({})).toBeUndefined();
});
