import { z } from 'zod';

import {
  addDays,
  type DayKey,
  DayKeySchema,
  type Instant,
  InstantSchema,
  toInstant,
} from '@/models/day';
import type { Draft } from '@/models/draft';
import { type Minor, MinorSchema, type SignedMinor, SignedMinorSchema } from '@/models/money';
import {
  DirectionSchema,
  type MaskedRow,
  MaskedRowSchema,
  type Transaction,
  TransactionSchema,
  type TxId,
  TxIdSchema,
} from '@/models/transaction';

import { type Db, parseRows, type SqlValue } from './db';
import { searchKey } from './sanitize';
import { DEMO_ACCOUNT } from './seed';

export const PAGE_SIZE = 100;

export type Flow = 'all' | 'in' | 'out';
export type TxFilter = { readonly flow: Flow; readonly search: string };
export const NO_FILTER: TxFilter = { flow: 'all', search: '' };

/** Where a keyset page ends: the last row it holds. */
export type PageCursor = { readonly postedAt: Instant; readonly id: TxId };

/** Malaysia-time days, both ends included. */
export type DayRange = { readonly from: DayKey; readonly to: DayKey };

const MASKED = `id, currency, type, description, merchant, category, status, posted_at, day,
  reference, account_name, account_last4, source`;
const REVEALED = `id, amount_minor, currency, type, description, merchant, category, status, posted_at,
  reference, account_name, account_last4, source`;

type Clause = { readonly sql: string; readonly params: readonly SqlValue[] };

const FLOW: { readonly [F in Flow]: Clause | null } = {
  all: null,
  in: { sql: "type = 'credit'", params: [] },
  out: { sql: "type = 'debit'", params: [] },
};

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function searchClause(search: string): Clause | null {
  const key = searchKey(search);
  return key === ''
    ? null
    : { sql: "search_text LIKE ? ESCAPE '\\'", params: [`%${escapeLike(key)}%`] };
}

function daysClause(days: DayRange | undefined): Clause | null {
  if (days === undefined) return null;
  return {
    sql: 'posted_at >= ? AND posted_at < ?',
    params: [`${addDays(days.from, -1)}T16:00:00.000Z`, `${days.to}T16:00:00.000Z`],
  };
}

function where(...clauses: (Clause | null)[]): Clause {
  const present = clauses.filter((c): c is Clause => c !== null);
  if (present.length === 0) return { sql: '', params: [] };
  return {
    sql: `WHERE ${present.map((c) => c.sql).join(' AND ')}`,
    params: present.flatMap((c) => c.params),
  };
}

const filterClauses = (filter: TxFilter) => [FLOW[filter.flow], searchClause(filter.search)];

const before = (after: PageCursor | null): Clause | null =>
  after === null ? null : { sql: '(posted_at, id) < (?, ?)', params: [after.postedAt, after.id] };

const CursorSchema = z.object({ posted_at: InstantSchema, id: TxIdSchema });

export type MaskedPage = {
  readonly rows: readonly MaskedRow[];
  readonly skipped: number;
  readonly next: PageCursor | null;
};

/** A keyset page, newest first. One extra row is read so `next` is null on the last page, not after it. */
export async function readPage(
  db: Db,
  query: { readonly filter: TxFilter; readonly after: PageCursor | null; readonly limit?: number },
): Promise<MaskedPage> {
  const limit = query.limit ?? PAGE_SIZE;
  const w = where(...filterClauses(query.filter), before(query.after));
  const raw = await db.all(
    `SELECT ${MASKED} FROM tx ${w.sql} ORDER BY posted_at DESC, id DESC LIMIT ?`,
    [...w.params, limit + 1],
  );
  const page = raw.slice(0, limit);
  const { rows, skipped } = parseRows(page, MaskedRowSchema);
  const last = raw.length > limit ? CursorSchema.safeParse(page[page.length - 1]) : null;
  return {
    rows,
    skipped,
    next: last?.success ? { postedAt: last.data.posted_at, id: last.data.id } : null,
  };
}

const AmountSchema = z.strictObject({ id: TxIdSchema, amountMinor: MinorSchema });

/** Amounts for every loaded row: those from the newest down to and including `through`. Only while revealed. */
export async function readRevealedAmounts(
  db: Db,
  query: { readonly filter: TxFilter; readonly through: PageCursor },
): Promise<ReadonlyMap<TxId, Minor>> {
  const through: Clause = {
    sql: '(posted_at, id) >= (?, ?)',
    params: [query.through.postedAt, query.through.id],
  };
  const w = where(...filterClauses(query.filter), through);
  const { rows } = parseRows(
    await db.all(`SELECT id, amount_minor FROM tx ${w.sql}`, w.params),
    AmountSchema,
  );
  return new Map(rows.map((row) => [row.id, row.amountMinor]));
}

const Count = z.number().int().nonnegative();
const TotalsRows = z.array(
  z.object({ type: DirectionSchema, n: Count, total: MinorSchema.optional() }),
);

export type MaskedTotals = {
  readonly in: { readonly count: number };
  readonly out: { readonly count: number };
};
export type RevealedTotals = {
  readonly in: { readonly count: number; readonly minor: Minor };
  readonly out: { readonly count: number; readonly minor: Minor };
};

type TotalsQuery = { readonly filter: TxFilter; readonly days?: DayRange };

async function totals(db: Db, query: TotalsQuery, sum: boolean) {
  const w = where(...filterClauses(query.filter), daysClause(query.days));
  const select = sum ? 'type, count(*) AS n, sum(amount_minor) AS total' : 'type, count(*) AS n';
  const rows = TotalsRows.parse(
    await db.all(`SELECT ${select} FROM tx ${w.sql} GROUP BY type`, w.params),
  );
  const side = (type: 'credit' | 'debit') => rows.find((row) => row.type === type);
  return { in: side('credit'), out: side('debit') };
}

export async function readTotals(db: Db, query: TotalsQuery): Promise<MaskedTotals> {
  const t = await totals(db, query, false);
  return { in: { count: t.in?.n ?? 0 }, out: { count: t.out?.n ?? 0 } };
}

export async function readRevealedTotals(db: Db, query: TotalsQuery): Promise<RevealedTotals> {
  const t = await totals(db, query, true);
  const side = (row: typeof t.in) => ({
    count: row?.n ?? 0,
    minor: row?.total ?? MinorSchema.parse(0),
  });
  return { in: side(t.in), out: side(t.out) };
}

export type MaskedDay = { readonly day: DayKey; readonly count: number };
export type RevealedDay = MaskedDay & { readonly netMinor: SignedMinor };

const DayRows = z.array(z.strictObject({ day: DayKeySchema, count: Count }));
const RevealedDayRows = z.array(
  z.strictObject({ day: DayKeySchema, count: Count, netMinor: SignedMinorSchema }),
);

type DaysQuery = { readonly filter: TxFilter; readonly days: DayRange };

function daysSql(query: DaysQuery, select: string) {
  const w = where(...filterClauses(query.filter), daysClause(query.days));
  return [`SELECT ${select} FROM tx ${w.sql} GROUP BY day ORDER BY day DESC`, w.params] as const;
}

export async function readDayNets(db: Db, query: DaysQuery): Promise<readonly MaskedDay[]> {
  return DayRows.parse(await db.all(...daysSql(query, 'day, count(*) AS count')));
}

/** Rows and the net (money in less money out) per day, newest day first. */
export async function readRevealedDayNets(
  db: Db,
  query: DaysQuery,
): Promise<readonly RevealedDay[]> {
  const select = `day, count(*) AS count,
    sum(CASE type WHEN 'credit' THEN amount_minor ELSE -amount_minor END) AS netMinor`;
  return RevealedDayRows.parse(await db.all(...daysSql(query, select)));
}

/** One row for the detail screen, masked. Null when it doesn't exist or can't be read. */
export async function getTransaction(db: Db, id: TxId): Promise<MaskedRow | null> {
  const { rows } = parseRows(
    await db.all(`SELECT ${MASKED} FROM tx WHERE id = ?`, [id]),
    MaskedRowSchema,
  );
  return rows[0] ?? null;
}

export async function getRevealedTransaction(db: Db, id: TxId): Promise<Transaction | null> {
  const { rows } = parseRows(
    await db.all(`SELECT ${REVEALED} FROM tx WHERE id = ?`, [id]),
    TransactionSchema,
  );
  return rows[0] ?? null;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function manualReference(idemKey: string): string {
  const bits = [...idemKey.replaceAll('-', '').slice(0, 10)]
    .map((hex) => parseInt(hex, 16).toString(2).padStart(4, '0'))
    .join('');
  let code = '';
  for (let i = 0; i < 40; i += 5) code += CROCKFORD[parseInt(bits.slice(i, i + 5), 2)];
  return `SEN-M-${code}`;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const OFFSET_MS = 8 * 60 * MINUTE_MS;

function postedAtFor(day: DayKey, now: Instant): Instant {
  const timeOfDay = (Date.parse(now) + OFFSET_MS) % DAY_MS;
  return toInstant(new Date(Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS + timeOfDay));
}

const MANUAL_COLUMNS = [
  'id',
  'amount_minor',
  'currency',
  'type',
  'description',
  'merchant',
  'category',
  'status',
  'posted_at',
  'reference',
  'account_name',
  'account_last4',
  'source',
  'idem_key',
  'search_text',
] as const;

export type ManualInsert = { readonly row: MaskedRow; readonly created: boolean };

/** Adds a row from a parsed draft. A repeated `idemKey` writes nothing and returns the row already stored. */
export async function insertManual(db: Db, draft: Draft, now: Instant): Promise<ManualInsert> {
  const values: Record<(typeof MANUAL_COLUMNS)[number], SqlValue> = {
    id: `m-${draft.idemKey}`,
    amount_minor: draft.amountMinor,
    currency: 'MYR',
    type: draft.direction,
    description: draft.description,
    merchant: draft.description,
    category: draft.category,
    status: 'posted',
    posted_at: postedAtFor(draft.day, now),
    reference: manualReference(draft.idemKey),
    account_name: DEMO_ACCOUNT.name,
    account_last4: DEMO_ACCOUNT.last4,
    source: 'manual',
    idem_key: draft.idemKey,
    search_text: searchKey(draft.description),
  };
  return db.transaction(async (tx) => {
    const { changes } = await tx.run(
      `INSERT INTO tx (${MANUAL_COLUMNS.join(', ')}) VALUES (${MANUAL_COLUMNS.map(() => '?').join(', ')})
        ON CONFLICT DO NOTHING`,
      MANUAL_COLUMNS.map((column) => values[column]),
    );
    const { rows } = parseRows(
      await tx.all(`SELECT ${MASKED} FROM tx WHERE idem_key = ?`, [draft.idemKey]),
      MaskedRowSchema,
    );
    const row = rows[0];
    if (row === undefined) throw new Error('The added row could not be read back.');
    return { row, created: changes === 1 };
  });
}

export type DeleteOutcome = 'deleted' | 'missing' | 'read_only';

const UNDO_KEY = 'undo.deleted';
const SourceRows = z.array(z.object({ source: z.enum(['bank', 'manual']) }));

/**
 * Deletes a row added on the phone. Bank rows are read only. The deleted row is kept inside the encrypted database
 * for `restoreDeleted`, so undo never brings its amount into JS.
 */
export async function deleteManual(db: Db, id: TxId): Promise<DeleteOutcome> {
  return db.transaction(async (tx) => {
    const [found] = SourceRows.parse(await tx.all('SELECT source FROM tx WHERE id = ?', [id]));
    if (found === undefined) return 'missing';
    if (found.source === 'bank') return 'read_only';
    const fields = MANUAL_COLUMNS.map((column) => `'${column}', ${column}`).join(', ');
    await tx.run(
      `INSERT OR REPLACE INTO meta (key, value) SELECT ?, json_object(${fields}) FROM tx WHERE id = ?`,
      [UNDO_KEY, id],
    );
    await tx.run('DELETE FROM tx WHERE id = ?', [id]);
    return 'deleted';
  });
}

/** Puts back the row the last `deleteManual` removed. False when that row is not the one kept. */
export async function restoreDeleted(db: Db, id: TxId): Promise<boolean> {
  return db.transaction(async (tx) => {
    const fields = MANUAL_COLUMNS.map((column) => `json_extract(value, '$.${column}')`).join(', ');
    const { changes } = await tx.run(
      `INSERT INTO tx (${MANUAL_COLUMNS.join(', ')})
        SELECT ${fields} FROM meta WHERE key = ? AND json_extract(value, '$.id') = ?
        ON CONFLICT DO NOTHING`,
      [UNDO_KEY, id],
    );
    if (changes === 1) await tx.run('DELETE FROM meta WHERE key = ?', [UNDO_KEY]);
    return changes === 1;
  });
}

export async function countManual(db: Db): Promise<number> {
  const rows = await db.all("SELECT count(*) AS n FROM tx WHERE source = 'manual'");
  return Count.parse(rows[0]?.n);
}

/**
 * Erases every row added on the phone and the undo copy, in one transaction, so a failure leaves all of them.
 * Bank rows stay. Returns how many rows went.
 */
export async function eraseManual(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const { changes } = await tx.run("DELETE FROM tx WHERE source = 'manual'");
    await tx.run('DELETE FROM meta WHERE key = ?', [UNDO_KEY]);
    return changes;
  });
}
