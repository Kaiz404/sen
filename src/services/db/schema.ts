import { z } from 'zod';

import type { Db } from './port';

/** One statement per entry, because node:sqlite prepares one statement at a time. */
export type Migration = {
  readonly version: number;
  readonly statements: readonly string[];
  /**
   * The oldest app schema that can still read a file at this version. A step that only adds things keeps the number
   * of the step before it. A step that changes what an old app reads raises it to its own version.
   */
  readonly minReader: number;
};

const V1: Migration = {
  version: 1,
  minReader: 1,
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

/** When the bank reported a pending row as posted. Existing rows keep every value and read as never settled. */
const V2: Migration = {
  version: 2,
  minReader: 1,
  statements: [
    `ALTER TABLE tx ADD COLUMN settled_at TEXT CHECK (settled_at IS NULL OR settled_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')`,
  ],
};

export const MIGRATIONS: readonly Migration[] = [V1, V2];
export const SCHEMA_VERSION = MIGRATIONS.length;

/** `meta` key holding the oldest schema that can read this file, written by every migration step. */
const MIN_READER_KEY = 'schema.minReader';

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

const MinReaderRows = z.array(z.object({ reader: z.string() }));

/** A file with no recorded minimum reader (or no `meta` at all) is read as needing the version it is at. */
async function minReader(db: Db, found: number): Promise<number> {
  const [table] = await db.all(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
  );
  if (table === undefined) return found;
  const [row] = MinReaderRows.parse(
    await db.all('SELECT value AS reader FROM meta WHERE key = ?', [MIN_READER_KEY]),
  );
  const parsed = Number(row?.reader);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : found;
}

/**
 * Brings the file up to the ladder. A file newer than the app still opens when its recorded minimum reader is not
 * newer than the app, because a newer step that only added things leaves what this app reads intact. Only a file this
 * app cannot read throws `SchemaTooNewError`.
 */
export async function migrate(
  db: Db,
  ladder: readonly Migration[] = MIGRATIONS,
): Promise<MigrateOutcome> {
  const from = await userVersion(db);
  const to = ladder.length;
  if (from > to) {
    if ((await minReader(db, from)) > to) throw new SchemaTooNewError(from);
    return { from, to: from };
  }
  for (const step of ladder.slice(from)) {
    await db.transaction(async (tx) => {
      for (const sql of step.statements) await tx.run(sql);
      await tx.run(
        `INSERT INTO meta (key, value) VALUES ('${MIN_READER_KEY}', '${step.minReader}')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      );
      await tx.run(`PRAGMA user_version = ${step.version}`);
    });
  }
  return { from, to };
}
