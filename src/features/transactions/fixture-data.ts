import { type DayKey, InstantSchema, malaysiaDay } from '@/models/day';
import { type Minor, MinorSchema } from '@/models/money';
import { type MaskedRow, MaskedRowSchema, type TxId, TxIdSchema } from '@/models/transaction';
import { DEMO_ACCOUNT, generateBankRows } from '@/services/seed';

/** The boards' moment: Thursday 15 October 2026, 2:00 pm in Kuala Lumpur. */
export const BOARD_NOW = InstantSchema.parse('2026-10-15T06:00:00.000Z');
export const BOARD_TODAY: DayKey = malaysiaDay(BOARD_NOW);

const LUNCH = {
  id: 'm-board-lunch',
  amountMinor: 4250,
  currency: 'MYR',
  type: 'debit',
  description: 'Lunch with Hafiz, cash',
  merchant: 'Lunch with Hafiz, cash',
  category: 'food',
  status: 'posted',
  postedAt: '2026-10-15T05:42:00.000Z',
  reference: 'SEN-M-7Q2K9D3F',
  account: { ...DEMO_ACCOUNT },
  source: 'manual',
} as const;

type Fixture = { readonly row: MaskedRow; readonly amount: Minor };

function fixtures(size: 20 | 1000 | 10000): Fixture[] {
  const bank = generateBankRows(size, BOARD_NOW).map(({ seq: _seq, ...row }) => row);
  return [LUNCH, ...bank]
    .map(({ amountMinor, ...row }) => ({
      row: MaskedRowSchema.parse({ ...row, day: malaysiaDay(InstantSchema.parse(row.postedAt)) }),
      amount: MinorSchema.parse(amountMinor),
    }))
    .sort((a, b) => (a.row.postedAt < b.row.postedAt ? 1 : -1));
}

const BOARD = fixtures(20);

/** The boards' 21 rows, newest first: the 20 seeded bank rows and the added lunch. */
export const BOARD_ROWS: readonly MaskedRow[] = BOARD.map((f) => f.row);

/** Their amounts, for the shown states only. */
export const BOARD_AMOUNTS: ReadonlyMap<TxId, Minor> = new Map(
  BOARD.map((f) => [f.row.id, f.amount]),
);

/** A large masked list for render tests. Amounts are left behind. */
export function manyRows(size: 1000 | 10000): MaskedRow[] {
  return fixtures(size).map((f) => f.row);
}

export const txId = (id: string): TxId => TxIdSchema.parse(id);
