import { MaskedRowSchema, TransactionSchema } from '@/models/transaction';

import type { OpenDb } from './port';
import { parseRows } from './rows';
import { openTestDb } from './testing/node-adapter';

let db: OpenDb;

beforeEach(async () => {
  db = await openTestDb();
  const insert = `INSERT INTO tx (id, amount_minor, currency, type, description, merchant, category, status,
    posted_at, reference, account_name, account_last4, source, idem_key, search_text)
    VALUES (?, ?, 'MYR', 'debit', ?, ?, ?, 'pending', ?, ?, 'Everyday Savings', '4821', 'bank', NULL, ?)`;
  await db.run(insert, [
    'tx-tnb',
    14260,
    'TNB electricity',
    'TNB',
    'bills',
    '2026-10-14T01:00:00.000Z',
    'TNB-88231',
    'tnb electricity',
  ]);
  await db.run(insert, [
    'tx-bad',
    900,
    'Mystery',
    'Mystery',
    'not-a-category',
    '2026-10-13T01:00:00.000Z',
    'X-1',
    'mystery',
  ]);
});
afterEach(() => db.close());

const MASKED = `SELECT id, currency, type, description, merchant, category, status, posted_at, day,
  reference, account_name, account_last4, source FROM tx ORDER BY posted_at DESC, id DESC`;

test('a masked row parses with no amount, and a bad row is dropped and counted', async () => {
  expect(parseRows(await db.all(MASKED), MaskedRowSchema)).toEqual({
    rows: [
      {
        id: 'tx-tnb',
        currency: 'MYR',
        type: 'debit',
        description: 'TNB electricity',
        merchant: 'TNB',
        category: 'bills',
        status: 'pending',
        postedAt: '2026-10-14T01:00:00.000Z',
        day: '2026-10-14',
        reference: 'TNB-88231',
        account: { name: 'Everyday Savings', last4: '4821' },
        source: 'bank',
        settledAt: null,
      },
    ],
    skipped: 1,
  });
});

test('a masked query that selects the amount fails its parse instead of leaking it', async () => {
  const leaky = MASKED.replace('SELECT id,', 'SELECT id, amount_minor,');

  expect(parseRows(await db.all(leaky), MaskedRowSchema)).toEqual({ rows: [], skipped: 2 });
});

test('a revealed row carries its amount in sen', async () => {
  const revealed = MASKED.replace('SELECT id,', 'SELECT id, amount_minor,');

  const { rows, skipped } = parseRows(await db.all(revealed), TransactionSchema);
  expect(rows.map((row) => [row.id, row.amountMinor])).toEqual([['tx-tnb', 14260]]);
  expect(skipped).toBe(1);
});
