import { DayKeySchema } from './day';
import { draftSchema, isInAddWindow } from './draft';

const day = (s: string) => DayKeySchema.parse(s);
const today = day('2026-10-16');

test('the add window is today back to 90 days, never the future', () => {
  expect(isInAddWindow(day('2026-10-16'), today)).toBe(true);
  expect(isInAddWindow(day('2026-07-18'), today)).toBe(true);
  expect(isInAddWindow(day('2026-07-17'), today)).toBe(false);
  expect(isInAddWindow(day('2026-10-17'), today)).toBe(false);
});

const valid = {
  idemKey: '0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1',
  amountMinor: 4250,
  direction: 'debit',
  description: 'Lunch with Hafiz, cash',
  category: 'food',
  day: '2026-10-16',
};

test('a valid draft parses', () => {
  expect(draftSchema(today).safeParse(valid).success).toBe(true);
});

test.each([
  ['amount 0', { amountMinor: 0 }],
  ['amount over RM 50,000', { amountMinor: 5_000_001 }],
  ['a float amount', { amountMinor: 42.5 }],
  ['a one-letter description', { description: 'L' }],
  ['a bank-only category', { category: 'income' }],
  ['a future day', { day: '2026-10-17' }],
])('rejects %s', (_, patch) => {
  expect(draftSchema(today).safeParse({ ...valid, ...patch }).success).toBe(false);
});
