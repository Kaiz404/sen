import { InstantSchema, malaysiaDay } from '@/models/day';

import type { Db, OpenDb, SqlValue } from './port';
import { migrate, MIGRATIONS, SchemaTooNewError, userVersion } from './schema';
import { createNodeDb, openTestDb } from './testing/node-adapter';

let db: OpenDb;
afterEach(() => db.close());

const ROW = {
  id: 'tx-1',
  amount_minor: 4250,
  currency: 'MYR',
  type: 'debit',
  description: 'Lunch with Hafiz, cash',
  merchant: 'Cash',
  category: 'food',
  status: 'posted',
  posted_at: '2026-10-15T16:30:00.000Z',
  reference: 'SEN-0001',
  account_name: 'Everyday Savings',
  account_last4: '4821',
  source: 'manual',
  idem_key: '0b6f1c39-7f43-4b6e-9a43-58a2f6c0d5a1',
  search_text: 'lunch with hafiz, cash',
} satisfies Record<string, SqlValue>;

function insertTx(on: Db, patch: Partial<Record<keyof typeof ROW, SqlValue>> = {}) {
  const row = { ...ROW, ...patch };
  const columns = Object.keys(row);
  return on.run(
    `INSERT INTO tx (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  );
}

const tableNames = async (on: Db) =>
  (await on.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map(
    (row) => row.name,
  );

describe('migrations', () => {
  test('a fresh database migrates to version 1 with every table', async () => {
    db = createNodeDb();

    expect(await migrate(db)).toEqual({ from: 0, to: 1 });
    expect(await userVersion(db)).toBe(1);
    expect(await tableNames(db)).toEqual(['activity_log', 'meta', 'sync_state', 'tx']);
    expect(await db.all('SELECT id, cursor, synced_at FROM sync_state')).toEqual([
      { id: 1, cursor: 0, synced_at: null },
    ]);
  });

  test('running it again is a no-op', async () => {
    db = await openTestDb();

    expect(await migrate(db)).toEqual({ from: 1, to: 1 });
    expect(await db.all('SELECT count(*) AS n FROM sync_state')).toEqual([{ n: 1 }]);
  });

  test('a failing step rolls back its statements and its version', async () => {
    db = createNodeDb();
    const broken = [{ version: 1, statements: ['CREATE TABLE half (x INTEGER)', 'NOT SQL'] }];

    await expect(migrate(db, broken)).rejects.toThrow();
    expect(await userVersion(db)).toBe(0);
    expect(await tableNames(db)).toEqual([]);
  });

  test('a database newer than the app is refused', async () => {
    db = createNodeDb();
    await db.run('PRAGMA user_version = 7');

    await expect(migrate(db)).rejects.toBeInstanceOf(SchemaTooNewError);
  });

  test('the ladder counts up from 1 with no gaps', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      Array.from({ length: MIGRATIONS.length }, (_, i) => i + 1),
    );
  });
});

describe('schema v1', () => {
  beforeEach(async () => {
    db = await openTestDb();
  });

  test('STRICT refuses a float amount', async () => {
    await expect(insertTx(db, { amount_minor: 42.5 })).rejects.toThrow(
      'cannot store REAL value in INTEGER column tx.amount_minor',
    );
  });

  test('a repeated idempotency key is refused, so a double submit stores one row', async () => {
    await insertTx(db);

    await expect(insertTx(db, { id: 'tx-2' })).rejects.toThrow(
      'UNIQUE constraint failed: tx.idem_key',
    );
    expect(await db.all('SELECT id FROM tx')).toEqual([{ id: 'tx-1' }]);
  });

  test('day is the Malaysia-time day and matches malaysiaDay on both sides of 16:00 UTC', async () => {
    const before = '2026-10-15T15:59:59.999Z';
    const after = '2026-10-15T16:30:00.000Z';
    await insertTx(db, { id: 'before', posted_at: before, idem_key: 'k-before' });
    await insertTx(db, { id: 'after', posted_at: after, idem_key: 'k-after' });

    expect(await db.all('SELECT id, day FROM tx ORDER BY posted_at')).toEqual([
      { id: 'before', day: '2026-10-15' },
      { id: 'after', day: '2026-10-16' },
    ]);
    expect(malaysiaDay(InstantSchema.parse(before))).toBe('2026-10-15');
    expect(malaysiaDay(InstantSchema.parse(after))).toBe('2026-10-16');
  });

  test('the activity log keeps the newest 50 rows', async () => {
    for (let i = 0; i < 60; i++) {
      const at = `2026-10-15T10:${String(i).padStart(2, '0')}:00.000Z`;
      await db.run('INSERT INTO activity_log (id, at, code) VALUES (?, ?, ?)', [
        `log-${i}`,
        at,
        'app.unlocked',
      ]);
    }

    expect(
      await db.all('SELECT count(*) AS n, min(id) AS oldest, max(id) AS newest FROM activity_log'),
    ).toEqual([{ n: 50, oldest: 'log-10', newest: 'log-59' }]);
  });

  test('the masked keyset page searches the page index with no sort step', async () => {
    const plan = await db.all(
      `EXPLAIN QUERY PLAN SELECT id, currency, type, description, merchant, category, status, posted_at, day,
        reference, account_name, account_last4, source
        FROM tx WHERE (posted_at, id) < (?, ?) ORDER BY posted_at DESC, id DESC LIMIT 100`,
      ['2026-10-16T00:00:00.000Z', 'z'],
    );

    expect(plan.map((row) => row.detail)).toEqual([
      'SEARCH tx USING INDEX tx_by_time ((posted_at,id)<(?,?))',
    ]);
  });
});
