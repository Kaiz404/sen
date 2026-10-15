import { z } from 'zod';

import { ADD_CATEGORIES } from './category';
import { addDays, type DayKey, DayKeySchema } from './day';
import { MinorSchema } from './money';
import { DirectionSchema } from './transaction';

export const DRAFT_LIMITS = {
  /** RM 0.01 */
  minMinor: 1,
  /** RM 50,000.00 */
  maxMinor: 5_000_000,
  keypadDigits: 7,
  descriptionMin: 2,
  descriptionMax: 60,
  daysBack: 90,
} as const;

/**
 * The add form's output, parsed before review. `description` arrives cleaned by `services/sanitize.ts`, so
 * this checks only its length. The window for `day` depends on today, so the schema is built per call.
 */
export function draftSchema(today: DayKey) {
  return z.object({
    idemKey: z.uuid(),
    amountMinor: MinorSchema.refine(
      (n) => n >= DRAFT_LIMITS.minMinor && n <= DRAFT_LIMITS.maxMinor,
      'amount out of range',
    ),
    direction: DirectionSchema,
    description: z.string().min(DRAFT_LIMITS.descriptionMin).max(DRAFT_LIMITS.descriptionMax),
    category: z.enum(ADD_CATEGORIES),
    day: DayKeySchema.refine((d) => isInAddWindow(d, today), 'date out of range'),
  });
}
export type Draft = z.infer<ReturnType<typeof draftSchema>>;

/** Today back to 90 days. Never the future. DayKeys are fixed width, so text order is day order. */
export function isInAddWindow(day: DayKey, today: DayKey): boolean {
  return day <= today && day >= addDays(today, -DRAFT_LIMITS.daysBack);
}
