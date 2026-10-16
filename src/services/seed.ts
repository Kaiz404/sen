import type { z } from 'zod';

import type { CategoryId } from '@/models/category';
import { addDays, type DayKey, type Instant, malaysiaDay, toInstant } from '@/models/day';
import type { PrefValue } from '@/models/prefs';
import type { TransactionSchema } from '@/models/transaction';

export const SEED = 57;

export type DatasetSize = PrefValue<'demo.datasetSize'>;

/** A row as the bank sends it: a transaction and its feed position. Unbranded, because the bank sits outside the boundary. */
export type BankRow = z.input<typeof TransactionSchema> & { readonly seq: number };

export const DEMO_ACCOUNT = { name: 'Everyday Savings', last4: '4821' } as const;

type Direction = 'debit' | 'credit';
type Status = 'posted' | 'pending';
type NonEmpty<T> = readonly [T, ...T[]];

type Unnumbered = Omit<BankRow, 'id' | 'seq'>;
type RowFields = Pick<
  Unnumbered,
  'type' | 'amountMinor' | 'status' | 'category' | 'description' | 'merchant'
>;

type BoardRow = {
  readonly daysAgo: number;
  readonly minute: number;
  readonly refDigits: string | null;
  readonly fields: RowFields;
};

const clock = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

const board = (
  daysAgo: number,
  hhmm: string,
  type: Direction,
  amountMinor: number,
  status: Status,
  category: CategoryId,
  description: string,
  merchant: string,
  refDigits: string | null = null,
): BoardRow => ({
  daysAgo,
  minute: clock(hhmm),
  refDigits,
  fields: { type, amountMinor, status, category, description, merchant },
});

const PAYDAY = board(
  2,
  '09:00',
  'credit',
  650000,
  'posted',
  'income',
  'Salary · [EMPLOYER]',
  '[EMPLOYER]',
);

/**
 * The newest 20 rows of every dataset. The first eight are drawn on SF-History, SF-Reveal and SF-Detail, where today
 * is Thu 15 Oct. The other twelve fill 1 to 12 Oct, so with the boards' added row (Lunch with Hafiz, RM 42.50) the
 * month card reads Money out RM 2,317.40 and Money in RM 6,850.00, as on SF-Reveal.
 */
// prettier-ignore
const BOARD: NonEmpty<BoardRow> = [
  board(0,  '13:15', 'debit',     990, 'pending', 'food',      'Tealive',                       'Tealive'),
  board(0,  '11:02', 'credit',  35000, 'posted',  'transfer',  'DuitNow from Aisyah Rahman',    'Aisyah Rahman'),
  board(0,  '08:42', 'debit',    1850, 'pending', 'transport', 'Grab ride to KL Sentral',       'Grab'),
  board(1,  '18:20', 'debit',   14260, 'pending', 'bills',     'TNB electricity',               'Tenaga Nasional Berhad', '00478213'),
  board(1,  '09:47', 'debit',    5680, 'posted',  'shopping',  'Shopee',                        'Shopee'),
  board(1,  '07:30', 'debit',    5000, 'posted',  'topup',     "Touch 'n Go eWallet reload",    "Touch 'n Go eWallet"),
  board(2,  '13:08', 'debit',    2430, 'posted',  'food',      'GrabFood',                      'GrabFood'),
  PAYDAY,
  board(3,  '20:15', 'debit',    1290, 'posted',  'food',      'ZUS Coffee',                    'ZUS Coffee'),
  board(4,  '17:40', 'debit',    4735, 'posted',  'groceries', '99 Speedmart',                  '99 Speedmart'),
  board(5,  '08:05', 'debit',    8000, 'posted',  'transport', 'Petronas',                      'Petronas'),
  board(6,  '10:30', 'debit',   12900, 'posted',  'bills',     'Unifi home fibre',              'Telekom Malaysia'),
  board(7,  '19:22', 'debit',    3870, 'posted',  'health',    'Watsons',                       'Watsons'),
  board(8,  '18:45', 'debit',   15645, 'posted',  'groceries', 'Mydin',                         'Mydin'),
  board(9,  '12:10', 'debit',    9800, 'posted',  'bills',     'Maxis postpaid',                'Maxis'),
  board(10, '15:30', 'debit',   35230, 'posted',  'shopping',  'IKEA Damansara',                'IKEA'),
  board(11, '12:40', 'debit',    2350, 'posted',  'food',      'Nasi Kandar Pelita',            'Nasi Kandar Pelita'),
  board(12, '09:15', 'debit',   95000, 'posted',  'transfer',  'DuitNow to Farid Hassan, rent', 'Farid Hassan'),
  board(13, '11:20', 'debit',    3460, 'posted',  'bills',     'Air Selangor',                  'Air Selangor'),
  board(14, '08:30', 'debit',    5000, 'posted',  'transport', 'Rapid KL, KL Sentral',          'Rapid KL'),
];

type Template = {
  readonly weight: number;
  readonly category: CategoryId;
  readonly type: Direction;
  readonly min: number;
  readonly max: number;
  readonly variants: NonEmpty<readonly [description: string, merchant: string]>;
};

const kind = (
  weight: number,
  category: CategoryId,
  type: Direction,
  min: number,
  max: number,
  ...variants: [readonly [string, string], ...(readonly [string, string])[]]
): Template => ({ weight, category, type, min, max, variants });

const same = (name: string) => [name, name] as const;

/** The generated tail: what a Malaysian account might see over a year or two. Amounts in sen. */
// prettier-ignore
const TEMPLATES: NonEmpty<Template> = [
  kind(10, 'food',      'debit',  1200,  4800, same('GrabFood')),
  kind(7,  'food',      'debit',   690,  1590, same('Tealive')),
  kind(6,  'food',      'debit',   990,  1790, same('ZUS Coffee')),
  kind(5,  'food',      'debit',  1100,  3200, same('Nasi Kandar Pelita')),
  kind(4,  'food',      'debit',  1200,  3500, same("McDonald's")),
  kind(8,  'transport', 'debit',   700,  3800, ['Grab ride to KL Sentral', 'Grab'], ['Grab ride to Mid Valley', 'Grab'],
                                               ['Grab ride to Bangsar South', 'Grab'], ['Grab ride to KLCC', 'Grab']),
  kind(4,  'transport', 'debit',   200,   600, ['Rapid KL, KL Sentral', 'Rapid KL'], ['Rapid KL, Pasar Seni', 'Rapid KL']),
  kind(4,  'transport', 'debit',  3000, 12000, same('Petronas')),
  kind(2,  'transport', 'debit',  3000, 12000, same('Shell')),
  kind(6,  'groceries', 'debit',   800,  6500, same('99 Speedmart')),
  kind(4,  'groceries', 'debit',  3500, 22000, same("Lotus's")),
  kind(3,  'groceries', 'debit',  2500, 18000, same('Mydin')),
  kind(5,  'shopping',  'debit',  1500, 25000, same('Shopee')),
  kind(3,  'shopping',  'debit',  1500, 30000, same('Lazada')),
  kind(1,  'shopping',  'debit',  4990, 29900, same('Uniqlo')),
  kind(4,  'topup',     'debit',  2000, 10000, ["Touch 'n Go eWallet reload", "Touch 'n Go eWallet"]),
  kind(3,  'health',    'debit',  1500,  8000, same('Watsons')),
  kind(2,  'health',    'debit',  1500,  6000, same('Guardian')),
  kind(1,  'health',    'debit',  4000, 12000, same('Klinik Mediviron')),
  kind(1,  'bills',     'debit',  6000, 25000, ['TNB electricity', 'Tenaga Nasional Berhad']),
  kind(1,  'bills',     'debit',  4800,  9800, ['Maxis postpaid', 'Maxis']),
  kind(1,  'bills',     'debit',  1500,  6000, same('Air Selangor')),
  kind(2,  'other',     'debit',   300,  1500, ['Parking, Mid Valley', 'Mid Valley Megamall'], ['Parking, Pavilion KL', 'Pavilion KL']),
  kind(3,  'transfer',  'debit',  2000, 30000, ['DuitNow to Farid Hassan', 'Farid Hassan'], ['DuitNow to Mei Ling', 'Mei Ling'],
                                               ['DuitNow to Ravi Kumar', 'Ravi Kumar']),
  kind(2,  'transfer',  'credit', 2000, 40000, ['DuitNow from Aisyah Rahman', 'Aisyah Rahman'], ['DuitNow from Daniel Tan', 'Daniel Tan'],
                                               ['DuitNow from Nurul Huda', 'Nurul Huda']),
];

/** Small everyday spending, for the row that arrives on refresh. */
// prettier-ignore
const EVERYDAY: NonEmpty<Template> = [
  kind(4, 'food',      'debit', 690, 1590, same('Tealive')),
  kind(4, 'food',      'debit', 990, 1790, same('ZUS Coffee')),
  kind(3, 'food',      'debit', 1200, 4800, same('GrabFood')),
  kind(3, 'transport', 'debit', 700, 3800, ['Grab ride to KL Sentral', 'Grab'], ['Grab ride to Mid Valley', 'Grab']),
  kind(2, 'groceries', 'debit', 800, 6500, same('99 Speedmart')),
];

/** Mean rows a day in the tail: 1k is about a year at three a day, 10k about two years at fourteen. */
const ROWS_PER_DAY: Readonly<Record<DatasetSize, number>> = { 20: 0, 1000: 3, 10000: 14 };

const MINUTE_MS = 60_000;
const MALAYSIA_OFFSET_MINUTES = 8 * 60;

/** mulberry32, a small seeded generator. Demo data only, never anything secret. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;

const between = (rand: Random, min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

function pickOne<T>(rand: Random, items: NonEmpty<T>): T {
  return items[Math.floor(rand() * items.length)] ?? items[0];
}

function pickWeighted(rand: Random, items: NonEmpty<Template>): Template {
  let roll = rand() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[0];
}

/** The UTC instant of a minute of a Malaysia-time day. */
function instantAt(day: DayKey, minuteOfDay: number): Instant {
  const ms =
    Date.parse(`${day}T00:00:00.000Z`) + (minuteOfDay - MALAYSIA_OFFSET_MINUTES) * MINUTE_MS;
  return toInstant(new Date(ms));
}

const LATEST_TODAY = Math.max(...BOARD.filter((row) => row.daysAgo === 0).map((row) => row.minute));
const OLDEST_BOARD_DAY = Math.max(...BOARD.map((row) => row.daysAgo));

/**
 * The day the boards call "today": today in Malaysia once the boards' latest row (1:15 pm) has passed, yesterday
 * before that. So no row is ever in the future.
 */
export function boardToday(now: Instant): DayKey {
  return malaysiaDay(toInstant(new Date(Date.parse(now) - LATEST_TODAY * MINUTE_MS)));
}

const digits = (rand: Random) => String(Math.floor(rand() * 1e8)).padStart(8, '0');
const reference = (day: DayKey, tail: string) => `FT${day.slice(2).replaceAll('-', '')}${tail}`;

function bankRow(fields: RowFields, postedAt: Instant, ref: string): Unnumbered {
  return {
    ...fields,
    postedAt,
    reference: ref,
    currency: 'MYR',
    account: { ...DEMO_ACCOUNT },
    source: 'bank',
  };
}

function fromTemplate(
  rand: Random,
  template: Template,
  postedAt: Instant,
  status: Status,
): Unnumbered {
  const [description, merchant] = pickOne(rand, template.variants);
  const amountMinor = Math.max(
    template.min,
    Math.round(between(rand, template.min, template.max) / 10) * 10,
  );
  const fields = { type: template.type, category: template.category, amountMinor, status };
  return bankRow(
    { ...fields, description, merchant },
    postedAt,
    reference(malaysiaDay(postedAt), digits(rand)),
  );
}

function boardRows(rand: Random, today: DayKey): Unnumbered[] {
  return BOARD.map((row) => {
    const day = addDays(today, -row.daysAgo);
    return bankRow(
      row.fields,
      instantAt(day, row.minute),
      reference(day, row.refDigits ?? digits(rand)),
    );
  });
}

/** Walks back a day at a time from the day before the boards' first day. Salary lands on the boards' payday. */
function tailRows(rand: Random, today: DayKey, count: number, perDay: number): Unnumbered[] {
  const payday = addDays(today, -PAYDAY.daysAgo).slice(8);
  const rows: Unnumbered[] = [];
  for (
    let day = addDays(today, -OLDEST_BOARD_DAY - 1);
    rows.length < count;
    day = addDays(day, -1)
  ) {
    if (day.slice(8) === payday) {
      rows.push(
        bankRow(PAYDAY.fields, instantAt(day, PAYDAY.minute), reference(day, digits(rand))),
      );
    }
    const n = 1 + Math.floor(rand() * (2 * perDay - 1));
    for (let i = 0; i < n && rows.length < count; i++) {
      const at = instantAt(day, between(rand, 7 * 60, 23 * 60 - 1));
      rows.push(fromTemplate(rand, pickWeighted(rand, TEMPLATES), at, 'posted'));
    }
  }
  return rows;
}

const byTime = (a: Unnumbered, b: Unnumbered) =>
  a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0;

/**
 * The bank's whole feed for a dataset size, oldest first, so `seq` grows with time like a real feed. The newest 20
 * rows are the boards' rows. Pure: the same size, `now` and seed give the same rows.
 */
export function generateBankRows(size: DatasetSize, now: Instant, seed: number = SEED): BankRow[] {
  const rand = mulberry32(seed);
  const today = boardToday(now);
  const head = boardRows(rand, today);
  const tail = tailRows(rand, today, size - head.length, ROWS_PER_DAY[size]);
  return [...head, ...tail]
    .sort(byTime)
    .map((row, i) => ({ ...row, id: `bk-${i + 1}`, seq: i + 1 }));
}

/** The row that arrives on a refresh: small everyday spending, pending, at `now`. Pure in `seq`, `now` and seed. */
export function mintRow(seq: number, now: Instant, seed: number = SEED): BankRow {
  const rand = mulberry32(seed ^ Math.imul(seq, 0x9e3779b1));
  return {
    ...fromTemplate(rand, pickWeighted(rand, EVERYDAY), now, 'pending'),
    id: `bk-${seq}`,
    seq,
  };
}
