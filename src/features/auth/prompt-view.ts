import type { StoreCause } from '@/services/store-fault';

import type { AuthFailure, EnrolledLevel } from './prompt';
import type { UnlockOutcome } from './session';

/**
 * What Lock and the primer show. There is one key, so the views differ only in the line above it. The OS owns wrong
 * tries (D40), so no view counts misses or runs a lockout cool-down.
 */
export type PromptView =
  | { readonly kind: 'idle' }
  /** The prompt went unanswered past its clock (D36). Not a failed try, and the key is ready again. */
  | { readonly kind: 'timedOut' }
  /** The phone has no screen lock, so there is nothing for Sen to ask (D28). */
  | { readonly kind: 'noLock' }
  | { readonly kind: 'error' }
  /**
   * The vault would not open. `failures` counts opens in a row, from `firstAt` to `lastAt` (epoch ms), and a reset is
   * offered from the second (see `canReset`).
   */
  | {
      readonly kind: 'store';
      readonly cause: StoreCause;
      readonly failures: number;
      readonly firstAt: number;
      readonly lastAt: number;
    };

export const IDLE: PromptView = { kind: 'idle' };

export function initialView(level: EnrolledLevel): PromptView {
  return level === 'none' ? { kind: 'noLock' } : IDLE;
}

/**
 * The app came back to the front. A view about what the phone has set up follows what the phone says now. A store
 * view stays, since it describes an attempt, unless the phone now has no screen lock, which nothing can unlock.
 */
export function afterRecheck(prev: PromptView, level: EnrolledLevel): PromptView {
  if (level === 'none') return initialView(level);
  return prev.kind === 'idle' || prev.kind === 'timedOut' || prev.kind === 'noLock' ? IDLE : prev;
}

export function afterPrompt(prev: PromptView, failure: AuthFailure): PromptView {
  switch (failure) {
    case 'cancelled':
      return prev;
    case 'timedOut':
      return prev.kind === 'store' || prev.kind === 'noLock' ? prev : { kind: 'timedOut' };
    case 'noLock':
      return initialView('none');
    case 'unavailable':
    case 'unknown':
      return { kind: 'error' };
  }
}

export const RESET_AFTER = 2;
/**
 * expo-secure-store reports any keystore exception as an unreadable key, and a busy keystore clears by itself. A
 * `key` reset is offered only when the failures are this far apart, so two quick taps never reach it.
 */
export const KEY_RESET_SPAN_MS = 30_000;

/** A full disk clears when space is freed, so only the other causes offer to wipe the store. */
export function canReset(view: Extract<PromptView, { kind: 'store' }>): boolean {
  if (view.cause === 'full' || view.failures < RESET_AFTER) return false;
  return view.cause !== 'key' || view.lastAt - view.firstAt >= KEY_RESET_SPAN_MS;
}

export function afterUnlock(prev: PromptView, outcome: UnlockOutcome, now: number): PromptView {
  if (outcome.ok) return IDLE;
  if (outcome.reason !== 'store') return afterPrompt(prev, outcome.reason);
  const run = prev.kind === 'store' && prev.cause === outcome.cause ? prev : null;
  return {
    kind: 'store',
    cause: outcome.cause,
    failures: (run?.failures ?? 0) + 1,
    firstAt: run?.firstAt ?? now,
    lastAt: now,
  };
}
