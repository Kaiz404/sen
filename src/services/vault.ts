import type { AppError } from '@/models/errors';
import type { OpenDb } from '@/services/db';

type ResetReason = Extract<AppError, { kind: 'db_reset' }>['reason'];

/** `reset` means the old file could not be read and an empty database replaced it. */
export type VaultOpened =
  | { readonly kind: 'created' | 'opened'; readonly db: OpenDb }
  | { readonly kind: 'reset'; readonly db: OpenDb; readonly reason: ResetReason };

const pending = (): Promise<never> => Promise.reject(new Error('The vault lands with lane 2b.'));

export function hasVault(): Promise<boolean> {
  return pending();
}

export function openVault(): Promise<VaultOpened> {
  return pending();
}

export function destroyVault(): Promise<void> {
  return pending();
}
