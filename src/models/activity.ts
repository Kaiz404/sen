import { z } from 'zod';

import { InstantSchema } from './day';

const event = <C extends string, S extends z.ZodRawShape>(code: C, meta: S) =>
  z.strictObject({ code: z.literal(code), ...meta });

const LABEL = z.string().min(1).max(60).optional();

/**
 * One security event. Every shape is strict, so an extra field such as an amount is refused, and no shape has a
 * number a transaction could put there.
 */
export const ActivityEventSchema = z.discriminatedUnion('code', [
  event('auth.unlocked', {}),
  event('auth.failed', { reason: z.enum(['mismatch', 'lockout']) }),
  event('lock.locked', { reason: z.enum(['idle', 'background', 'manual']) }),
  event('amounts.revealed', {}),
  event('amounts.hidden', {}),
  event('tx.added', { label: LABEL }),
  event('tx.deleted', { label: LABEL }),
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
