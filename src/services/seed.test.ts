import { InstantSchema } from '@/models/day';
import { TransactionSchema } from '@/models/transaction';

import { boardToday, type DatasetSize, generateBankRows, mintRow } from './seed';

const at = (s: string) => InstantSchema.parse(s);
const NOW = at('2026-10-15T08:00:00.000Z');

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

test('the newest rows are the boards’ rows, at the boards’ times and amounts', () => {
  const newest = generateBankRows(20, NOW)
    .slice(-8)
    .reverse()
    .map((r) => [r.description, r.postedAt, r.type, r.amountMinor, r.status]);

  expect(newest).toEqual([
    ['Tealive', '2026-10-15T05:15:00.000Z', 'debit', 990, 'pending'],
    ['DuitNow from Aisyah Rahman', '2026-10-15T03:02:00.000Z', 'credit', 35000, 'posted'],
    ['Grab ride to KL Sentral', '2026-10-15T00:42:00.000Z', 'debit', 1850, 'pending'],
    ['TNB electricity', '2026-10-14T10:20:00.000Z', 'debit', 14260, 'pending'],
    ['Shopee', '2026-10-14T01:47:00.000Z', 'debit', 5680, 'posted'],
    ["Touch 'n Go eWallet reload", '2026-10-13T23:30:00.000Z', 'debit', 5000, 'posted'],
    ['GrabFood', '2026-10-13T05:08:00.000Z', 'debit', 2430, 'posted'],
    ['Salary · [EMPLOYER]', '2026-10-13T01:00:00.000Z', 'credit', 650000, 'posted'],
  ]);
});

test('TNB carries the detail board’s merchant and reference', () => {
  const tnb = generateBankRows(20, NOW).find((r) => r.description === 'TNB electricity');

  expect([tnb?.merchant, tnb?.reference, tnb?.category]).toEqual([
    'Tenaga Nasional Berhad',
    'FT26101400478213',
    'bills',
  ]);
});

test.each([20, 1000, 10000] as const)(
  'at %i rows, 1 to 15 Oct sums to the boards’ month card less the added RM 42.50',
  (size) => {
    const october = generateBankRows(size, NOW).filter(
      (r) => r.postedAt >= '2026-09-30T16:00:00.000Z',
    );
    const sum = (type: string) =>
      october.filter((r) => r.type === type).reduce((total, r) => total + r.amountMinor, 0);

    expect([october.length, sum('debit') + 4250, sum('credit')]).toEqual([20, 231740, 685000]);
  },
);

test('the same size, clock and seed give the same feed, and the seed changes it', () => {
  const hash = (seed?: number) => fnv1a(JSON.stringify(generateBankRows(1000, NOW, seed)));

  expect([hash(), hash()]).toEqual(['c7011a19', 'c7011a19']);
  expect(hash(58)).not.toBe('c7011a19');
});

test.each([
  [20, '2026-10-01T00:30:00.000Z'],
  [1000, '2025-11-20T03:37:00.000Z'],
  [10000, '2024-09-16T00:24:00.000Z'],
] as const)(
  '%i rows: exact count, valid, unique, in seq and time order, oldest %s',
  (size, oldest) => {
    const rows = generateBankRows(size as DatasetSize, NOW);

    expect(rows.length).toBe(size);
    expect(rows[0]?.postedAt).toBe(oldest);
    expect(rows.filter((r) => !TransactionSchema.safeParse(r).success)).toEqual([]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(size);
    expect(rows.every((r, i) => r.seq === i + 1)).toBe(true);
    expect(rows.every((r, i) => i === 0 || rows[i - 1]!.postedAt <= r.postedAt)).toBe(true);
  },
);

test.each([
  ['just after midnight', '2026-10-14', '2026-10-14T16:00:00.000Z'],
  ['a moment before 1:15 pm', '2026-10-14', '2026-10-15T05:14:59.999Z'],
  ['at 1:15 pm', '2026-10-15', '2026-10-15T05:15:00.000Z'],
  ['just before midnight', '2026-10-15', '2026-10-15T15:59:59.999Z'],
])('%s on 15 Oct, the boards’ today is %s and no row is in the future', (_, today, now) => {
  const rows = generateBankRows(1000, at(now));

  expect(boardToday(at(now))).toBe(today);
  expect(rows.at(-1)?.postedAt).toBe(`${today}T05:15:00.000Z`);
  expect(rows.filter((r) => r.postedAt > now)).toEqual([]);
});

test('a minted row is pending, at now, valid, and the same for the same seq', () => {
  const row = mintRow(1001, NOW);

  expect([row.id, row.seq, row.postedAt, row.status, row.source]).toEqual([
    'bk-1001',
    1001,
    NOW,
    'pending',
    'bank',
  ]);
  expect(TransactionSchema.safeParse(row).success).toBe(true);
  expect(mintRow(1001, NOW)).toEqual(row);
  expect(mintRow(1002, NOW).reference).not.toBe(row.reference);
});
