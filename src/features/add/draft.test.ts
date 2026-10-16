import { DayKeySchema } from '@/models/day';

import { draftReducer, hasInput, newDraft, toDraft } from './draft';

const TODAY = DayKeySchema.parse('2026-10-15');
const KEY = '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b';

const filled = (over: Partial<ReturnType<typeof newDraft>> = {}) => ({
  ...newDraft(KEY, TODAY),
  amountMinor: 4250,
  description: 'Lunch with Hafiz, cash',
  category: 'food' as const,
  ...over,
});

test('keys reach the amount through the draft', () => {
  const typed = ['4', '2', '5', '0'].reduce(
    (draft, key) => draftReducer(draft, { type: 'key', key: key as '4' }),
    newDraft(KEY, TODAY),
  );
  expect(typed.amountMinor).toBe(4250);
});

test('a fresh draft has no input, and a typed digit, a description or a category each count', () => {
  const fresh = newDraft(KEY, TODAY);
  expect(hasInput(fresh)).toBe(false);
  expect(hasInput(draftReducer(fresh, { type: 'direction', direction: 'credit' }))).toBe(false);
  expect(hasInput(draftReducer(fresh, { type: 'key', key: '5' }))).toBe(true);
  expect(hasInput(draftReducer(fresh, { type: 'description', text: 'L' }))).toBe(true);
  expect(hasInput(draftReducer(fresh, { type: 'category', category: 'food' }))).toBe(true);
});

test('the stored draft carries the sanitised description', () => {
  const raw = 'Lunch​  with‮ Hafiz,\u0007 cash  ';
  expect(toDraft(filled({ description: raw }), TODAY)).toEqual({
    idemKey: KEY,
    amountMinor: 4250,
    direction: 'debit',
    description: 'Lunch with Hafiz, cash',
    category: 'food',
    day: '2026-10-15',
  });
});

test.each([
  ['an empty amount', { amountMinor: 0 }],
  ['an amount over RM 50,000.00', { amountMinor: 5_000_001 }],
  ['a description that cleans to one character', { description: ' A​ ' }],
  ['no category', { category: null }],
  ['tomorrow', { day: DayKeySchema.parse('2026-10-16') }],
  ['91 days ago', { day: DayKeySchema.parse('2026-07-16') }],
])('%s is not a draft the repo can store', (_, over) => {
  expect(toDraft(filled(over), TODAY)).toBeNull();
});

test('90 days ago and RM 50,000.00 are still in range', () => {
  const edge = toDraft(
    filled({ amountMinor: 5_000_000, day: DayKeySchema.parse('2026-07-17') }),
    TODAY,
  );
  expect(edge?.day).toBe('2026-07-17');
  expect(edge?.amountMinor).toBe(5_000_000);
});
