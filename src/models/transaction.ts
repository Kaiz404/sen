import { z } from 'zod';

import { CategorySchema } from './category';
import { DayKeySchema, InstantSchema } from './day';
import { MinorSchema } from './money';

export const TxIdSchema = z.string().min(1).max(64).brand<'TxId'>();
export type TxId = z.infer<typeof TxIdSchema>;

export const DirectionSchema = z.enum(['debit', 'credit']);
export const StatusSchema = z.enum(['posted', 'pending']);
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

export const TransactionSchema = z.object({
  ...fields,
  amountMinor: MinorSchema.refine((n) => n > 0, 'amount must be positive'),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const MaskedRowSchema = z.strictObject({ ...fields, day: DayKeySchema });
export type MaskedRow = z.infer<typeof MaskedRowSchema>;

export const TransactionPageSchema = z.object({
  items: z.array(z.unknown()),
  nextSeq: z.number().int().nonnegative().nullable(),
});
export type TransactionPage = z.infer<typeof TransactionPageSchema>;
