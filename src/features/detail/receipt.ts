import { clockText } from '@/features/transactions';
import { CATEGORY_LABEL } from '@/models/category';
import type { DayKey } from '@/models/day';
import { moneyText, type SignedMinor } from '@/models/money';
import type { MaskedRow } from '@/models/transaction';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed 14 Oct 2026". */
function longDay(day: DayKey): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Wed 14 Oct 2026, 6:20 pm". */
export function dateTime(row: MaskedRow): string {
  return `${longDay(row.day)}, ${clockText(row.postedAt)}`;
}

/** The line under the hero amount: "MONEY OUT · WED 14 OCT 2026 · 6:20 PM". */
export function heroCaption(row: MaskedRow): string {
  const side = row.type === 'debit' ? 'MONEY OUT' : 'MONEY IN';
  return `${side} · ${longDay(row.day)} · ${clockText(row.postedAt)}`.toUpperCase();
}

/** The stamp's date, "14·10·26". */
export function stampDate(day: DayKey): string {
  return `${day.slice(8, 10)}·${day.slice(5, 7)}·${day.slice(2, 4)}`;
}

/** "Added on this phone, 15 Oct 1:42 pm". */
export function addedText(row: MaskedRow): string {
  const date = new Date(`${row.day}T00:00:00.000Z`);
  return `Added on this phone, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${clockText(row.postedAt)}`;
}

export function statusText(row: MaskedRow): string {
  return row.status === 'pending' ? 'Pending' : 'Posted';
}

/** Bank rows name the ledger side. Added rows have no ledger, so they read plainly. */
export function typeText(row: MaskedRow): string {
  const plain = row.type === 'debit' ? 'Money out' : 'Money in';
  if (row.source === 'manual') return plain;
  return `${row.type === 'debit' ? 'Debit' : 'Credit'}, ${plain.toLowerCase()}`;
}

export type Fact = {
  readonly label: string;
  readonly text: string;
  readonly tone: 'plain' | 'pending';
};

/** The receipt's facts table. An added row's merchant is its description, so it has no merchant line. */
export function receiptFacts(row: MaskedRow): readonly Fact[] {
  const fact = (label: string, text: string): Fact => ({ label, text, tone: 'plain' });
  return [
    ...(row.source === 'bank' ? [fact('MERCHANT', row.merchant)] : []),
    fact('CATEGORY', CATEGORY_LABEL[row.category]),
    fact('DATE & TIME', dateTime(row)),
    fact('ACCOUNT', `${row.account.name} ·· ${row.account.last4}`),
    fact('TYPE', typeText(row)),
    {
      label: 'STATUS',
      text: statusText(row),
      tone: row.status === 'pending' ? 'pending' : 'plain',
    },
  ];
}

export type StepState = 'done' | 'now' | 'next';
export type PaymentStep = {
  readonly label: 'Authorised' | 'Pending' | 'Posted';
  readonly state: StepState;
  readonly caption: string;
};

/**
 * Authorised, Pending, Posted for a pending bank payment. Null for anything else: a posted or added row has nothing
 * left to track. The bank gives no settle date, so Posted says only that it comes next.
 */
export function paymentSteps(row: MaskedRow): readonly PaymentStep[] | null {
  if (row.source !== 'bank' || row.status !== 'pending') return null;
  const weekday = WEEKDAYS[new Date(`${row.day}T00:00:00.000Z`).getUTCDay()];
  return [
    {
      label: 'Authorised',
      state: 'done',
      caption: `${weekday} ${clockText(row.postedAt)}`.toUpperCase(),
    },
    { label: 'Pending', state: 'now', caption: 'NOW' },
    { label: 'Posted', state: 'next', caption: 'NEXT' },
  ];
}

/**
 * The plain text the share sheet gets: no image, no link, no balance. It takes the amount, so a receipt can't be
 * shared while hidden.
 */
export function shareText(row: MaskedRow, amount: SignedMinor): string {
  return [
    'Sen receipt',
    row.merchant === row.description ? row.description : `${row.description} · ${row.merchant}`,
    `${moneyText(amount)} · ${statusText(row)}`,
    dateTime(row),
    `${row.account.name} ·· ${row.account.last4}`,
    `${typeText(row)} · ${CATEGORY_LABEL[row.category]}`,
    `Ref ${row.reference}`,
  ].join('\n');
}
