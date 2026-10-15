import { z } from 'zod';

import type { Db } from './port';

/**
 * One step on the ladder: the statements that take `user_version` from `version - 1` to `version`.
 * One statement per entry, because node:sqlite prepares one statement at a time. Append only: a shipped
 * step is never edited.
 */
export type Migration = { readonly version: number; readonly statements: readonly string[] };

/**
 * Schema v1. STRICT tables refuse a float `amount_minor`. The GLOB check refuses an instant without
 * milliseconds, so text order is time order. `idem_key` exists only on manual rows and is UNIQUE, which is
 * the double-submit guard. `day` is the Malaysia-time day, generated from `posted_at`. A trigger keeps the
 * newest 50 log rows. `category` is unchecked on purpose: a row SQL accepts can still fail
 * `TransactionSchema`, and is then dropped and counted.
 */
const V1: Migration = {
  version: 1,
  statements: [
    `CREATE TABLE tx (
      id            TEXT PRIMARY KEY NOT NULL,
      amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0),
      currency      TEXT NOT NULL CHECK (currency = 'MYR'),
      type          TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
      description   TEXT NOT NULL,
      merchant      TEXT NOT NULL,
      category      TEXT NOT NULL,
      status        TEXT NOT NULL CHECK (status IN ('posted', 'pending')),
      posted_at     TEXT NOT NULL CHECK (posted_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
      day           TEXT NOT NULL GENERATED ALWAYS AS (date(posted_at, '+8 hours')) STORED,
      reference     TEXT NOT NULL,
      account_name  TEXT NOT NULL,
      account_last4 TEXT NOT NULL CHECK (length(account_last4) = 4),
      source        TEXT NOT NULL CHECK (source IN ('bank', 'manual')),
      idem_key      TEXT UNIQUE CHECK ((source = 'manual') = (idem_key IS NOT NULL)),
      search_text   TEXT NOT NULL
    ) STRICT`,
    `CREATE INDEX tx_by_time ON tx (posted_at DESC, id DESC)`,
    `CREATE TABLE sync_state (
      id        INTEGER PRIMARY KEY CHECK (id = 1),
      cursor    INTEGER NOT NULL DEFAULT 0 CHECK (cursor >= 0),
      synced_at TEXT
    ) STRICT`,
    `INSERT INTO sync_state (id) VALUES (1)`,
    `CREATE TABLE activity_log (
      id   TEXT PRIMARY KEY NOT NULL,
      at   TEXT NOT NULL,
      code TEXT NOT NULL,
      meta TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta))
    ) STRICT`,
    `CREATE INDEX activity_log_by_time ON activity_log (at DESC, id DESC)`,
    `CREATE TRIGGER activity_log_cap AFTER INSERT ON activity_log BEGIN
      DELETE FROM activity_log WHERE id IN (
        SELECT id FROM activity_log ORDER BY at DESC, id DESC LIMIT -1 OFFSET 50
      );
    END`,
    `CREATE TABLE meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    ) STRICT`,
  ],
};

export const MIGRATIONS: readonly Migration[] = [V1];
export const SCHEMA_VERSION = MIGRATIONS.length;

/** The file was written by a newer app. The caller resets it as `db_reset` `corrupt`. */
export class SchemaTooNewError extends Error {
  constructor(readonly found: number) {
    super(`Database schema ${found} is newer than this app's ${SCHEMA_VERSION}.`);
  }
}

const UserVersionRows = z.tuple([z.object({ user_version: z.number().int().nonnegative() })]);

export async function userVersion(db: Db): Promise<number> {
  const [row] = UserVersionRows.parse(await db.all('PRAGMA user_version'));
  return row.user_version;
}

export type MigrateOutcome = { readonly from: number; readonly to: number };

/**
 * Brings the database up to the top of `ladder`. Each step and its `PRAGMA user_version` run in one
 * transaction, so a step that fails leaves the previous version intact. Running it again is a no-op.
 */
export async function migrate(
  db: Db,
  ladder: readonly Migration[] = MIGRATIONS,
): Promise<MigrateOutcome> {
  const from = await userVersion(db);
  const to = ladder.length;
  if (from > to) throw new SchemaTooNewError(from);
  for (const step of ladder.slice(from)) {
    await db.transaction(async (tx) => {
      for (const sql of step.statements) await tx.run(sql);
      await tx.run(`PRAGMA user_version = ${step.version}`);
    });
  }
  return { from, to };
}
