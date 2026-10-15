import { z } from 'zod';

import { CategorySchema } from './category';
import { InstantSchema } from './day';
import { MinorSchema } from './money';

export const TxIdSchema = z.string().min(1).max(64).brand<'TxId'>();
export type TxId = z.infer<typeof TxIdSchema>;

export const DirectionSchema = z.enum(['debit', 'credit']);
export const StatusSchema = z.enum(['posted', 'pending']);
/** Bank rows are read-only. Manual rows can be deleted. */
export const SourceSchema = z.enum(['bank', 'manual']);

const fields = {
  id: TxIdSchema,
  currency: z.literal('MYR'),
  type: DirectionSchema,
  description: z.string().min(1).max(120),
  merchant: z.string().min(1).max(120),
  category: CategorySchema,
  status: StatusSchema,
  postedAt: InstantSchema,
  reference: z.string().min(1).max(40),
  account: z.object({ name: z.string().min(1), last4: z.string().regex(/^\d{4}$/) }),
  source: SourceSchema,
};

/**
 * The full record. `amountMinor` is the magnitude in sen and `type` carries the direction, so the two can't
 * disagree. Only revealed queries and the write path ever hold one.
 */
export const TransactionSchema = z.object({
  ...fields,
  amountMinor: MinorSchema.refine((n) => n > 0, 'amount must be positive'),
});
export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * What masked queries return. It has no amount field, and it is strict: a masked query that selects
 * `amount_minor` by mistake fails its parse instead of carrying the amount along.
 */
export const MaskedRowSchema = z.strictObject(fields);
export type MaskedRow = z.infer<typeof MaskedRowSchema>;

/**
 * One page from the mock bank. Only the envelope is parsed here. Sync parses each item with
 * `TransactionSchema` on its own, so one bad row is dropped and counted instead of failing the page.
 * `nextSeq` is null on the last page.
 */
export const TransactionPageSchema = z.object({
  items: z.array(z.unknown()),
  nextSeq: z.number().int().nonnegative().nullable(),
});
export type TransactionPage = z.infer<typeof TransactionPageSchema>;
