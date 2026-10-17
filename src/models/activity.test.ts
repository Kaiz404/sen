import { ActivityEventSchema } from './activity';
import { DRAFT_LIMITS } from './draft';

const ACTIVITY_CODES = ActivityEventSchema.options.map((o) => o.shape.code.def.values[0]);

test('a transaction event takes a label and refuses an amount', () => {
  expect(
    ActivityEventSchema.safeParse({ code: 'tx.added', label: 'Lunch with Hafiz' }).success,
  ).toBe(true);
  expect(ActivityEventSchema.safeParse({ code: 'tx.added', amountMinor: 4250 }).success).toBe(
    false,
  );
  expect(
    ActivityEventSchema.safeParse({ code: 'tx.deleted', label: 'Parking', amount: '42.50' })
      .success,
  ).toBe(false);
  expect(
    ActivityEventSchema.safeParse({ code: 'tx.undone', of: 'add', amountMinor: 1 }).success,
  ).toBe(false);
});

test('every code has a shape and an unknown code is refused', () => {
  expect(ACTIVITY_CODES).toEqual([
    'auth.unlocked',
    'auth.failed',
    'lock.locked',
    'amounts.revealed',
    'amounts.hidden',
    'tx.added',
    'tx.deleted',
    'tx.erased',
    'tx.undone',
    'settings.weakened',
    'demo.reset',
    'log.cleared',
  ]);
  expect(ActivityEventSchema.safeParse({ code: 'tx.edited' }).success).toBe(false);
});

test('a setting event holds minutes from the setting table and nothing else', () => {
  expect(
    ActivityEventSchema.safeParse({ code: 'settings.weakened', setting: 'idleLock', minutes: 10 })
      .success,
  ).toBe(true);
  expect(
    ActivityEventSchema.safeParse({ code: 'settings.weakened', setting: 'idleLock', minutes: 4250 })
      .success,
  ).toBe(false);
});

test('a label can be as long as a description may be, and no longer', () => {
  const label = (n: number) => ({ code: 'tx.added', label: 'x'.repeat(n) });
  expect(ActivityEventSchema.safeParse(label(DRAFT_LIMITS.descriptionMax)).success).toBe(true);
  expect(ActivityEventSchema.safeParse(label(DRAFT_LIMITS.descriptionMax + 1)).success).toBe(false);
});

test('an erase event holds a row count and nothing else', () => {
  expect(ActivityEventSchema.safeParse({ code: 'tx.erased', count: 3 }).success).toBe(true);
  expect(ActivityEventSchema.safeParse({ code: 'tx.erased', count: 0 }).success).toBe(false);
  expect(
    ActivityEventSchema.safeParse({ code: 'tx.erased', count: 3, amountMinor: 4250 }).success,
  ).toBe(false);
});
