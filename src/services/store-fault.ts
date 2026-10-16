/** Why the vault would not open, in the words Lock can name. */
export type StoreCause = 'full' | 'key' | 'store';

export class KeyUnreadableError extends Error {
  constructor(options: { cause: unknown }) {
    super('The stored database key could not be read.', options);
  }
}

/** SQLITE_FULL (13), as expo-sqlite and Android word it. */
const DISK_FULL = /Error code 13\b|database or disk is full|No space left/i;

export function storeCauseOf(error: unknown): StoreCause {
  if (error instanceof KeyUnreadableError) return 'key';
  if (error instanceof Error && DISK_FULL.test(error.message)) return 'full';
  return 'store';
}
