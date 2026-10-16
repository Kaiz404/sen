import { getRandomValues } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import type { AppError } from '@/models/errors';
import {
  DB_NAME,
  type DbKey,
  DbKeySchema,
  DbUnreadableError,
  deleteDb,
  type OpenDb,
  openDb,
  SchemaTooNewError,
} from '@/services/db';

import { logEvent } from './logger';
import { clearPrefs } from './prefs';

type ResetReason = Extract<AppError, { kind: 'db_reset' }>['reason'];

/** `reset` means the old file could not be read and an empty database replaced it. */
export type VaultOpened =
  | { readonly kind: 'created' | 'opened'; readonly db: OpenDb }
  | { readonly kind: 'reset'; readonly db: OpenDb; readonly reason: ResetReason };

export const KEY_NAME = 'sen.dbKey.v1';

/** Readable only while the phone is unlocked, never restored to another device. No `requireAuthentication` (ARCHITECTURE › Storage and keys). */
export const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** The native pieces the vault needs, small enough to fake in tests. */
export type VaultPorts = {
  readonly keys: {
    read(): Promise<string | null>;
    write(key: DbKey): Promise<void>;
    remove(): Promise<void>;
  };
  readonly database: {
    open(key: DbKey): Promise<OpenDb>;
    /** Deletes the file. A file that isn't there is already deleted. */
    remove(): Promise<void>;
    exists(): boolean;
  };
  readonly randomBytes: (length: number) => Uint8Array;
  readonly clearPrefs: () => void;
};

type KeyState = 'stored' | 'missing';

/**
 * The reset rules. A stored key opens the file or, if the file can't be read, resets it as corrupt. With no key, a
 * fresh file is created, and a file the new key can't read (a backup restore or a reinstall) resets as missing_key.
 */
const RULES = {
  stored: { opened: 'opened', reset: 'corrupt' },
  missing: { opened: 'created', reset: 'missing_key' },
} as const satisfies Record<KeyState, { opened: 'created' | 'opened'; reset: ResetReason }>;

/** Only a file that can never be read resets. Anything else, such as a busy disk, rethrows and wipes nothing. */
const isUnreadable = (error: unknown) =>
  error instanceof DbUnreadableError || error instanceof SchemaTooNewError;

const KEY_BYTES = 32;

function newKey(randomBytes: VaultPorts['randomBytes']): DbKey {
  const hex = Array.from(randomBytes(KEY_BYTES), (byte) => byte.toString(16).padStart(2, '0'));
  return DbKeySchema.parse(hex.join(''));
}

export function createVault(ports: VaultPorts) {
  /**
   * iOS keeps Keychain items after the app is deleted, so a key whose database file is gone is left from an old
   * install. It is deleted, and the vault counts as missing.
   */
  async function storedKey(): Promise<DbKey | null> {
    const raw = await ports.keys.read();
    if (raw !== null && !ports.database.exists()) {
      await ports.keys.remove();
      return null;
    }
    const parsed = DbKeySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async function open(key: DbKey, state: KeyState): Promise<VaultOpened> {
    const rule = RULES[state];
    try {
      return { kind: rule.opened, db: await ports.database.open(key) };
    } catch (error) {
      if (!isUnreadable(error)) throw error;
      await ports.database.remove();
      return { kind: 'reset', reason: rule.reset, db: await ports.database.open(key) };
    }
  }

  return {
    /** A valid key and its database file both exist. */
    async hasVault(): Promise<boolean> {
      return (await storedKey()) !== null;
    },

    /** A new key is stored only after its database opened, so a failed first open leaves no orphan key. */
    async openVault(): Promise<VaultOpened> {
      const stored = await storedKey();
      const state: KeyState = stored === null ? 'missing' : 'stored';
      const key = stored ?? newKey(ports.randomBytes);
      const opened = await open(key, state);
      if (state === 'missing') {
        try {
          await ports.keys.write(key);
        } catch (error) {
          await opened.db.close();
          throw error;
        }
      }
      logEvent(opened.kind === 'reset' ? `vault.reset.${opened.reason}` : `vault.${opened.kind}`);
      return opened;
    },

    /** Deletes the key first, so the file is unreadable even if deleting it fails. The caller closes the database. */
    async destroyVault(): Promise<void> {
      await ports.keys.remove();
      await ports.database.remove();
      ports.clearPrefs();
      logEvent('vault.destroyed');
    },
  };
}

/** expo-sqlite's message when the file is absent, on Android and iOS (expo-sqlite 57 native source). */
const NOT_FOUND = /Database .* not found/;

const nativePorts: VaultPorts = {
  keys: {
    read: () => SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS),
    write: (key) => SecureStore.setItemAsync(KEY_NAME, key, KEY_OPTIONS),
    remove: () => SecureStore.deleteItemAsync(KEY_NAME, KEY_OPTIONS),
  },
  database: {
    open: (key) => openDb(key),
    remove: async () => {
      try {
        await deleteDb();
      } catch (error) {
        if (!(error instanceof Error && NOT_FOUND.test(error.message))) throw error;
      }
    },
    /** expo-sqlite keeps databases in `SQLite/` under the documents directory on Android and iOS (expo-sqlite 57 native source). */
    exists: () => new File(Paths.document, 'SQLite', DB_NAME).exists,
  },
  randomBytes: (length) => getRandomValues(new Uint8Array(length)),
  clearPrefs,
};

const vault = createVault(nativePorts);

export function hasVault(): Promise<boolean> {
  return vault.hasVault();
}

export function openVault(): Promise<VaultOpened> {
  return vault.openVault();
}

export function destroyVault(): Promise<void> {
  return vault.destroyVault();
}
