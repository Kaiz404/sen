import { DatabaseSync } from 'node:sqlite';

import { createDb, type OpenDb, sqlRow } from '../port';
import { migrate } from '../schema';

/**
 * Jest only. Lint bans importing this folder and `node:sqlite` outside test files, so it never reaches the
 * app bundle. The port semantics come from the same `createDb` the device uses.
 */

/** A fresh in-memory database at `user_version` 0, for migration tests. */
export function createNodeDb(): OpenDb {
  const native = new DatabaseSync(':memory:');
  return createDb({
    all: async (sql, params) =>
      native
        .prepare(sql)
        .all(...params)
        .map(sqlRow),
    run: async (sql, params) => ({
      changes: Number(native.prepare(sql).run(...params).changes),
    }),
    close: async () => native.close(),
  });
}

/** A fresh in-memory database at the current schema. Every service test starts here. */
export async function openTestDb(): Promise<OpenDb> {
  const db = createNodeDb();
  await migrate(db);
  return db;
}
