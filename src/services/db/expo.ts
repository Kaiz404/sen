import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { createDb, type Driver, type OpenDb, sqlRow } from './port';
import { migrate } from './schema';

/**
 * 32 random bytes as 64 hex characters. The key is the one string ever interpolated into SQL, so only a
 * value that passed this schema can reach the PRAGMA. Where the key comes from is the `db-key` service's job.
 */
export const DbKeySchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'a database key is 64 hex characters')
  .brand<'DbKey'>();
export type DbKey = z.infer<typeof DbKeySchema>;

/** The file can't be read: a wrong key, or a file that isn't a database. The caller resets it. */
export class DbUnreadableError extends Error {
  constructor(options: { cause: unknown }) {
    super('The database could not be read with this key.', options);
  }
}

export const DB_NAME = 'sen.db';

function driver(native: SQLiteDatabase): Driver {
  return {
    all: async (sql, params) =>
      (await native.getAllAsync<Record<string, unknown>>(sql, [...params])).map(sqlRow),
    run: async (sql, params) => ({ changes: (await native.runAsync(sql, [...params])).changes }),
    close: () => native.closeAsync(),
  };
}

/**
 * Opens the SQLCipher file and applies the key as a raw key (`PRAGMA key = "x'…'"`, no PBKDF2) before
 * anything else touches it. It proves the key with one read, then migrates.
 * It never uses `withExclusiveTransactionAsync`, which opens a second connection without the key.
 * `db.transaction` gives the same isolation on this one connection.
 */
export async function openDb(key: DbKey, name: string = DB_NAME): Promise<OpenDb> {
  const native = await openDatabaseAsync(name);
  try {
    await native.execAsync(`PRAGMA key = "x'${key}'"`);
    await native.getAllAsync('SELECT count(*) FROM sqlite_master', []);
  } catch (cause) {
    await native.closeAsync();
    throw new DbUnreadableError({ cause });
  }
  const db = createDb(driver(native));
  try {
    await migrate(db);
  } catch (error) {
    await db.close();
    throw error;
  }
  return db;
}

/** Sign-out and the missing-key reset. Close the handle first. */
export function deleteDb(name: string = DB_NAME): Promise<void> {
  return deleteDatabaseAsync(name);
}
