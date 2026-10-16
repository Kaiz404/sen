import type { IconName } from '@/components/key';
import { CATEGORY_LABEL, type CategoryId } from '@/models/category';
import { addDays, type DayKey, type Instant } from '@/models/day';
import type { Direction } from '@/models/money';
import type { MaskedRow, TxId } from '@/models/transaction';

export type RowTag = 'pending' | 'added';

/** What one row shows. Built from a masked row, so it has no amount to carry. */
export type TxRowView = {
  readonly id: TxId;
  readonly title: string;
  readonly time: string;
  /** The category line. Null when a tag takes its place. */
  readonly detail: string | null;
  readonly tag: RowTag | null;
  readonly direction: Direction;
  readonly icon: IconName;
  readonly tone: number;
  readonly shape: number;
};

/**
 * One cell of the flat history list. A day opens with its sticky top, then its rows, then its net, which closes
 * the slip. `first` marks the row under the perforated edge.
 */
export type HistoryItem =
  | { readonly kind: 'day'; readonly key: string; readonly title: string; readonly caption: string }
  | { readonly kind: 'tx'; readonly key: string; readonly row: TxRowView; readonly first: boolean }
  | { readonly kind: 'net'; readonly key: string; readonly day: DayKey };

export type HistoryRows = {
  readonly items: readonly HistoryItem[];
  readonly sticky: readonly number[];
};

const GLYPH: Readonly<Record<CategoryId, { readonly icon: IconName; readonly tone: number }>> = {
  food: { icon: 'food', tone: 0 },
  groceries: { icon: 'cart', tone: 5 },
  transport: { icon: 'car', tone: 2 },
  bills: { icon: 'lightning-bolt', tone: 3 },
  shopping: { icon: 'shopping', tone: 4 },
  health: { icon: 'medical-bag', tone: 0 },
  transfer: { icon: 'bank-transfer-in', tone: 1 },
  topup: { icon: 'wallet', tone: 5 },
  income: { icon: 'briefcase', tone: 1 },
  other: { icon: 'dots-horizontal', tone: 2 },
};

export const GLYPH_SHAPES = 3;

const HOUR_MS = 3_600_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Malaysia time of day, such as "1:42 pm". */
export function clockText(at: Instant): string {
  const local = new Date(Date.parse(at) + 8 * HOUR_MS);
  const h = local.getUTCHours();
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

function dayParts(day: DayKey) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return {
    weekday: WEEKDAYS[date.getUTCDay()]!,
    date: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()]!,
  };
}

export function monthName(day: DayKey): string {
  return MONTH_NAMES[Number(day.slice(5, 7)) - 1]!;
}

/** "so far, 1 to 15 Oct" for the month that holds `today`. */
export function monthSoFar(today: DayKey): string {
  const { date, month } = dayParts(today);
  return date === 1 ? `so far, 1 ${month}` : `so far, 1 to ${date} ${month}`;
}

function dayTop(day: DayKey, today: DayKey, payday: boolean) {
  const { weekday, date, month } = dayParts(day);
  const full = `${weekday} ${date} ${month}`;
  const near = day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : null;
  return {
    title: near ?? full,
    caption: payday ? 'PAYDAY' : near === null ? '' : full.toUpperCase(),
  };
}

function detailFor(row: MaskedRow): string {
  if (row.category === 'transfer') return row.type === 'credit' ? 'Transfer in' : 'Transfer out';
  return CATEGORY_LABEL[row.category];
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const views = new WeakMap<MaskedRow, TxRowView>();

/** One view per row object, so a row that comes back from the cache unchanged keeps its view and skips a render. */
export function toRowView(row: MaskedRow): TxRowView {
  const known = views.get(row);
  if (known !== undefined) return known;
  const tag: RowTag | null =
    row.source === 'manual' ? 'added' : row.status === 'pending' ? 'pending' : null;
  const glyph = GLYPH[row.category];
  const view: TxRowView = {
    id: row.id,
    title: row.description,
    time: clockText(row.postedAt),
    detail: tag === null ? detailFor(row) : null,
    tag,
    direction: row.type,
    icon:
      row.category === 'transfer' && row.type === 'debit' ? 'bank-transfer-out' : glyph.icon,
    tone: glyph.tone,
    shape: hash(row.id) % GLYPH_SHAPES,
  };
  views.set(row, view);
  return view;
}

/**
 * Turns loaded rows, newest first, into the flat list FlashList draws. A day's slip closes with its net only once
 * every row of that day is loaded: a day followed by an older day is whole, and so is the last day when no page
 * is left.
 */
export function buildHistoryRows(
  rows: readonly MaskedRow[],
  { today, complete }: { readonly today: DayKey; readonly complete: boolean },
): HistoryRows {
  const items: HistoryItem[] = [];
  const sticky: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const opens = i === 0 || rows[i - 1]!.day !== row.day;
    if (opens) {
      let payday = false;
      for (let j = i; j < rows.length && rows[j]!.day === row.day; j++) {
        if (rows[j]!.category === 'income') payday = true;
      }
      sticky.push(items.length);
      items.push({ kind: 'day', key: `day-${row.day}`, ...dayTop(row.day, today, payday) });
    }
    items.push({ kind: 'tx', key: row.id, row: toRowView(row), first: opens });
    const next = rows[i + 1];
    if (next === undefined ? complete : next.day !== row.day) {
      items.push({ kind: 'net', key: `net-${row.day}`, day: row.day });
    }
  }
  return { items, sticky };
}
