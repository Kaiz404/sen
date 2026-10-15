import { addDays, DayKeySchema, InstantSchema, malaysiaDay, toInstant } from './day';

const at = (s: string) => InstantSchema.parse(s);
const day = (s: string) => DayKeySchema.parse(s);

test('the Malaysia day turns over at 16:00 UTC', () => {
  expect(malaysiaDay(at('2026-10-15T15:59:59.999Z'))).toBe('2026-10-15');
  expect(malaysiaDay(at('2026-10-15T16:00:00.000Z'))).toBe('2026-10-16');
  expect(malaysiaDay(at('2026-10-15T16:30:00.000Z'))).toBe('2026-10-16');
});

test('addDays crosses month and year ends', () => {
  expect(addDays(day('2026-10-31'), 1)).toBe('2026-11-01');
  expect(addDays(day('2026-01-01'), -1)).toBe('2025-12-31');
  expect(addDays(day('2026-10-16'), -90)).toBe('2026-07-18');
});

test('an instant is fixed width, with milliseconds and Z', () => {
  expect(toInstant(new Date(Date.UTC(2026, 9, 15, 16, 30)))).toBe('2026-10-15T16:30:00.000Z');
  expect(InstantSchema.safeParse('2026-10-15T16:30:00Z').success).toBe(false);
});
