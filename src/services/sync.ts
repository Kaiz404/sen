import { z } from 'zod';

import { type Instant, InstantSchema, toInstant } from '@/models/day';
import { err, ok, type Result } from '@/models/errors';
import { type Transaction, TransactionPageSchema, TransactionSchema } from '@/models/transaction';

import type { BankApi } from './bank-api';
import type { Db, SqlValue } from './db';
import { logEvent } from './logger';
import { searchKey } from './sanitize';

export const SYNC_PAGE_SIZE = 500;

const BankRowSchema = TransactionSchema.extend({ source: z.literal('bank') });
const SeqSchema = z.object({ seq: z.number().int().positive() });

const COLUMNS = [
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

const UPDATABLE = COLUMNS.filter((c) => c !== 'id' && c !== 'source' && c !== 'idem_key');

/** Rows per INSERT. Fewer native round trips than one row per call, well under SQLite's bound-parameter limit. */
const CHUNK = 50;

function bankParams(row: Transaction): SqlValue[] {
  return [
    row.id,
    row.amountMinor,
    row.currency,
    row.type,
    row.description,
    row.merchant,
    row.category,
    row.status,
    row.postedAt,
    row.reference,
    row.account.name,
    row.account.last4,
    'bank',
    null,
    searchKey(row.description),
  ];
}

/** A bank row may update a bank row. The `WHERE` keeps it from ever overwriting a row added on the phone. */
function upsertSql(rows: number): string {
  const tuple = `(${COLUMNS.map(() => '?').join(', ')})`;
  return `INSERT INTO tx (${COLUMNS.join(', ')}) VALUES ${Array.from({ length: rows }, () => tuple).join(', ')}
    ON CONFLICT(id) DO UPDATE SET ${UPDATABLE.map((c) => `${c} = excluded.${c}`).join(', ')}
    WHERE tx.source = 'bank'`;
}

async function upsertBankRows(db: Db, rows: readonly Transaction[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.run(upsertSql(chunk.length), chunk.flatMap(bankParams));
  }
}

type ReadPage = {
  readonly rows: readonly Transaction[];
  readonly skipped: number;
  readonly lastSeq: number | null;
};

/** Parses each item on its own, so one bad row is dropped and counted instead of failing the page. */
function readItems(items: readonly unknown[]): ReadPage {
  const rows: Transaction[] = [];
  let lastSeq: number | null = null;
  for (const item of items) {
    const seq = SeqSchema.safeParse(item);
    if (seq.success) lastSeq = Math.max(lastSeq ?? 0, seq.data.seq);
    const row = BankRowSchema.safeParse(item);
    if (row.success) rows.push(row.data);
  }
  return { rows, skipped: items.length - rows.length, lastSeq };
}

const SyncStateRows = z.tuple([
  z.object({ cursor: z.number().int().nonnegative(), synced_at: InstantSchema.nullable() }),
]);

export type SyncState = { readonly cursor: number; readonly syncedAt: Instant | null };

export async function readSyncState(db: Db): Promise<SyncState> {
  const [row] = SyncStateRows.parse(await db.all('SELECT cursor, synced_at FROM sync_state'));
  return { cursor: row.cursor, syncedAt: row.synced_at };
}

export type SyncSummary = { readonly received: number; readonly cursor: number };

export type SyncOptions = {
  readonly now?: () => Instant;
  readonly pageSize?: number;
  readonly onProgress?: (received: number) => void;
};

/**
 * Pulls the feed after the saved cursor. Each page commits in one transaction with its cursor, so a sync that stops
 * anywhere resumes where the last commit left it, and running it again converges on the same table.
 * Rows that parsed are kept even when others were bad, and the bad ones come back as `invalid_data`.
 */
export async function sync(
  db: Db,
  bank: BankApi,
  { now = () => toInstant(new Date()), pageSize = SYNC_PAGE_SIZE, onProgress }: SyncOptions = {},
): Promise<Result<SyncSummary>> {
  let { cursor } = await readSyncState(db);
  let received = 0;
  let skipped = 0;
  for (;;) {
    const response = await bank.fetchPage({ since: cursor, limit: pageSize });
    if (!response.ok) {
      logEvent(`sync.failed.${response.error.kind}`);
      return response;
    }
    const page = TransactionPageSchema.safeParse(response.data);
    if (!page.success) return failed();

    const read = readItems(page.data.items);
    const next = Math.max(cursor, read.lastSeq ?? cursor);
    if (page.data.nextSeq !== null && next === cursor) return failed();

    await db.transaction(async (tx) => {
      await upsertBankRows(tx, read.rows);
      await tx.run('UPDATE sync_state SET cursor = ?, synced_at = ? WHERE id = 1', [next, now()]);
    });
    cursor = next;
    received += read.rows.length;
    skipped += read.skipped;
    onProgress?.(received);
    if (page.data.nextSeq === null) break;
  }
  if (skipped > 0) {
    logEvent('sync.failed.invalid_data');
    return err({ kind: 'invalid_data', skipped });
  }
  logEvent('sync.done');
  return ok({ received, cursor });
}

/** A page the client can't read, or one that claims more rows without moving the cursor, is the server's fault. */
function failed(): Result<never> {
  logEvent('sync.failed.server');
  return err({ kind: 'server' });
}

/** For a dataset switch: drops bank rows and rewinds the cursor in one step. Rows added on the phone stay. */
export async function resetBankRows(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM tx WHERE source = 'bank'");
    await tx.run('UPDATE sync_state SET cursor = 0, synced_at = NULL WHERE id = 1');
  });
}
