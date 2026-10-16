import type { StoreCause } from '@/services/store-fault';

import type { AuthFailure } from './prompt';
import type { UnlockOutcome } from './session';

export type PromptView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'mismatch'; readonly triesLeft: number }
  | { readonly kind: 'lockout'; readonly until: number }
  | { readonly kind: 'off'; readonly canOpenSettings: boolean }
  | { readonly kind: 'error' }
  /** The vault would not open. `failures` counts opens in a row, and a reset is offered from the second. */
  | { readonly kind: 'store'; readonly cause: StoreCause; readonly failures: number };

export const TRIES = 3;
/** Android's biometric lockout lasts 30 s. */
export const LOCKOUT_MS = 30_000;

export const IDLE: PromptView = { kind: 'idle' };

export function initialView(ready: boolean): PromptView {
  return ready ? IDLE : { kind: 'off', canOpenSettings: true };
}

export function afterPrompt(prev: PromptView, failure: AuthFailure, now: number): PromptView {
  switch (failure) {
    case 'cancelled':
      return prev;
    case 'mismatch': {
      const before = prev.kind === 'mismatch' ? prev.triesLeft : TRIES;
      return { kind: 'mismatch', triesLeft: Math.max(0, before - 1) };
    }
    case 'lockout':
      return { kind: 'lockout', until: now + LOCKOUT_MS };
    case 'not_set_up':
      return { kind: 'off', canOpenSettings: true };
    case 'unavailable':
      return { kind: 'off', canOpenSettings: false };
    case 'unknown':
      return { kind: 'error' };
  }
}

export const RESET_AFTER = 2;

/** A full disk clears when space is freed, so only the other causes offer to wipe the store. */
export function canReset(view: Extract<PromptView, { kind: 'store' }>): boolean {
  return view.cause !== 'full' && view.failures >= RESET_AFTER;
}

export function afterUnlock(prev: PromptView, outcome: UnlockOutcome, now: number): PromptView {
  if (outcome.ok) return prev;
  if (outcome.reason !== 'store') return afterPrompt(prev, outcome.reason, now);
  const failures = prev.kind === 'store' ? prev.failures + 1 : 1;
  return { kind: 'store', cause: outcome.cause, failures };
}
