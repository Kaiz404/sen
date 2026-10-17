import { z } from 'zod';

import { InstantSchema } from './day';
import { DRAFT_LIMITS } from './draft';

const event = <C extends string, S extends z.ZodRawShape>(code: C, meta: S) =>
  z.strictObject({ code: z.literal(code), ...meta });

/** A label is a transaction description, so it can be as long as one. */
export const ACTIVITY_LABEL_MAX = DRAFT_LIMITS.descriptionMax;

const LABEL = z.string().min(1).max(ACTIVITY_LABEL_MAX).optional();

/**
 * One security event. Every shape is strict, so an extra field such as an amount is refused, and no shape has a
 * number a transaction could put there. `tx.erased` carries how many rows went, never what they held.
 */
export const ActivityEventSchema = z.discriminatedUnion('code', [
  event('auth.unlocked', {}),
  event('auth.failed', { reason: z.enum(['mismatch', 'lockout']) }),
  event('lock.locked', { reason: z.enum(['idle', 'background', 'manual']) }),
  event('amounts.revealed', {}),
  event('amounts.hidden', {}),
  event('tx.added', { label: LABEL }),
  event('tx.deleted', { label: LABEL }),
  event('tx.erased', { count: z.number().int().min(1) }),
  event('tx.undone', { of: z.enum(['add', 'delete']), label: LABEL }),
  event('settings.weakened', {
    setting: z.enum(['idleLock', 'relockAfter']),
    minutes: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  }),
  event('demo.reset', {}),
  event('log.cleared', {}),
]);
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type ActivityCode = ActivityEvent['code'];

export const ACTIVITY_CAP = 50;

export const ActivityEntrySchema = z.object({
  id: z.string().min(1),
  at: InstantSchema,
  event: ActivityEventSchema,
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;
