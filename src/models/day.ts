import { z } from 'zod';

export const InstantSchema = z.iso.datetime({ precision: 3 }).brand<'Instant'>();
export type Instant = z.infer<typeof InstantSchema>;

export const DayKeySchema = z.iso.date().brand<'DayKey'>();
export type DayKey = z.infer<typeof DayKeySchema>;

/** Malaysia has no daylight saving, so a fixed offset is exact. */
export const MALAYSIA_UTC_OFFSET_HOURS = 8;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function toInstant(d: Date): Instant {
  return InstantSchema.parse(d.toISOString());
}

export function malaysiaDay(at: Instant): DayKey {
  const shifted = new Date(Date.parse(at) + MALAYSIA_UTC_OFFSET_HOURS * HOUR_MS);
  return DayKeySchema.parse(shifted.toISOString().slice(0, 10));
}

export function addDays(day: DayKey, n: number): DayKey {
  const shifted = new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS);
  return DayKeySchema.parse(shifted.toISOString().slice(0, 10));
}
