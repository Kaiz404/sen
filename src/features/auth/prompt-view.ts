import type { AuthFailure } from './prompt';

export type PromptView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'mismatch'; readonly triesLeft: number }
  | { readonly kind: 'lockout'; readonly until: number }
  | { readonly kind: 'off'; readonly canOpenSettings: boolean }
  | { readonly kind: 'error' };

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
