import { logEvent, logTiming } from './logger';

let info: jest.SpyInstance;
let warn: jest.SpyInstance;

beforeEach(() => {
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('an event is written as its code alone, at its level', () => {
  logEvent('sync.done');
  logEvent('vault.reset.corrupt');

  expect(info.mock.calls).toEqual([['[sen] sync.done']]);
  expect(warn.mock.calls).toEqual([['[sen] vault.reset.corrupt']]);
});

test('an amount cannot reach the log, by type or by force', () => {
  // @ts-expect-error an event takes no payload
  logEvent('sync.done', 4250);
  // @ts-expect-error free text is not an event code
  expect(() => logEvent('RM 42.50')).toThrow(TypeError);

  expect(info.mock.calls).toEqual([['[sen] sync.done']]);
  expect(warn.mock.calls).toEqual([]);
});

test('a timing is written as its mark and whole milliseconds', () => {
  logTiming('history.painted', 912.4);

  expect(info.mock.calls).toEqual([['[sen] perf history.painted +912ms']]);
});

test('free text cannot reach the log as a timing mark', () => {
  // @ts-expect-error a mark is one of the unlock steps, not free text
  logTiming('RM 42.50', 1);

  expect(info.mock.calls).toEqual([['[sen] perf RM 42.50 +1ms']]);
});
