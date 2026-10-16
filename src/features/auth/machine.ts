import type { OpenDb } from '@/services/db';

export type LockReason = 'launch' | 'idle' | 'background' | 'manual' | 'signout';
export type StepUpAction = 'reveal' | 'add' | 'delete' | 'clearLog' | 'erase';

export type Unlocked = { readonly status: 'unlocked'; readonly since: number; readonly db: OpenDb };

/**
 * `authenticating` is the unlock prompt only, from Lock (`unlock`) or the first-run primer (`setup`). A step-up
 * prompt is `stepUp`, which keeps the unlocked state it returns to, open database included. Whether amounts show
 * is the `hideAmounts` pref, not a session state (D27).
 */
export type Session =
  | { readonly status: 'launching' }
  | { readonly status: 'welcome' }
  | { readonly status: 'locked'; readonly reason: LockReason }
  | { readonly status: 'authenticating'; readonly purpose: 'setup' }
  | { readonly status: 'authenticating'; readonly purpose: 'unlock'; readonly reason: LockReason }
  | Unlocked
  | { readonly status: 'stepUp'; readonly action: StepUpAction; readonly returnTo: Unlocked };

export type SessionEvent =
  | { readonly type: 'LAUNCHED'; readonly hasVault: boolean }
  | { readonly type: 'AUTH_START' }
  | { readonly type: 'UNLOCK_OK'; readonly at: number; readonly db: OpenDb }
  | { readonly type: 'AUTH_FAIL' }
  | { readonly type: 'STEP_UP_START'; readonly action: StepUpAction }
  | { readonly type: 'STEP_UP_DONE' }
  | { readonly type: 'LOCK'; readonly reason: LockReason }
  | { readonly type: 'RESET' };

export const INITIAL: Session = { status: 'launching' };

/** Pure. An event that does not apply returns the same object, so the store skips the notify. */
export function reduce(state: Session, event: SessionEvent): Session {
  switch (event.type) {
    case 'LAUNCHED':
      if (state.status !== 'launching') return state;
      return event.hasVault ? { status: 'locked', reason: 'launch' } : { status: 'welcome' };

    case 'AUTH_START':
      if (state.status === 'welcome') return { status: 'authenticating', purpose: 'setup' };
      if (state.status === 'locked')
        return { status: 'authenticating', purpose: 'unlock', reason: state.reason };
      return state;

    case 'UNLOCK_OK':
      if (state.status !== 'authenticating') return state;
      return { status: 'unlocked', since: event.at, db: event.db };

    case 'AUTH_FAIL':
      if (state.status !== 'authenticating') return state;
      return state.purpose === 'setup'
        ? { status: 'welcome' }
        : { status: 'locked', reason: state.reason };

    case 'STEP_UP_START':
      if (state.status !== 'unlocked') return state;
      return { status: 'stepUp', action: event.action, returnTo: state };

    case 'STEP_UP_DONE':
      return state.status === 'stepUp' ? state.returnTo : state;

    case 'LOCK':
      if (state.status !== 'unlocked') return state;
      return { status: 'locked', reason: event.reason };

    case 'RESET':
      return state.status === 'locked' ? { status: 'welcome' } : state;

    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

export type RouteGate = 'welcome' | 'locked' | 'unlocked';

export function gateOf(state: Session): RouteGate {
  switch (state.status) {
    case 'welcome':
      return 'welcome';
    case 'authenticating':
      return state.purpose === 'setup' ? 'welcome' : 'locked';
    case 'launching':
    case 'locked':
      return 'locked';
    case 'unlocked':
    case 'stepUp':
      return 'unlocked';
  }
}

export function dbOf(state: Session): OpenDb | null {
  switch (state.status) {
    case 'unlocked':
      return state.db;
    case 'stepUp':
      return state.returnTo.db;
    case 'launching':
    case 'welcome':
    case 'locked':
    case 'authenticating':
      return null;
  }
}
