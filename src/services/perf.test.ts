import { logTiming } from './logger';
import { endUnlock, mark } from './perf';

jest.mock('./logger', () => ({ logTiming: jest.fn() }));

let now = 0;
beforeEach(() => {
  now = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.mocked(logTiming).mockClear();
  endUnlock();
});
afterEach(() => jest.restoreAllMocks());

const logged = () => jest.mocked(logTiming).mock.calls;

test('each step logs its time since the biometric prompt passed', () => {
  mark('unlock.ok');
  now += 40;
  mark('vault.opened');
  now += 900;
  mark('history.painted');

  expect(logged()).toEqual([
    ['unlock.ok', 0],
    ['vault.opened', 40],
    ['history.painted', 940],
  ]);
});

test('a step logs once per unlock, and a new unlock starts the count again', () => {
  mark('unlock.ok');
  now += 10;
  mark('history.mounted');
  now += 10;
  mark('history.mounted');
  expect(logged()).toEqual([
    ['unlock.ok', 0],
    ['history.mounted', 10],
  ]);

  now += 500;
  mark('unlock.ok');
  now += 7;
  mark('history.mounted');
  expect(logged().slice(2)).toEqual([
    ['unlock.ok', 0],
    ['history.mounted', 7],
  ]);
});

test('a release build logs nothing', () => {
  const dev = __DEV__;
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
  try {
    mark('unlock.ok');
    now += 5;
    mark('vault.opened');
  } finally {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
  }
  expect(logged()).toEqual([]);
});

test('the gallery and a cold launch draw History with no unlock, and log nothing', () => {
  mark('history.mounted');
  mark('history.painted');

  expect(logged()).toEqual([]);
});

test('marks after an unlock has ended log nothing', () => {
  mark('unlock.ok');
  endUnlock();
  mark('history.painted');

  expect(logged()).toEqual([['unlock.ok', 0]]);
});
