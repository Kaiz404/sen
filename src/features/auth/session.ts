import { useState } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { toast } from '@/components/toast';
import type { AppError } from '@/models/errors';
import type { OpenDb } from '@/services/db';
import { logEvent } from '@/services/logger';
import { endUnlock, mark } from '@/services/perf';
import { queryClient } from '@/services/query-client';
import { destroyVault, hasVault, openVault } from '@/services/vault';

import {
  dbOf,
  gateOf,
  INITIAL,
  reduce,
  type RouteGate,
  type Session,
  type SessionEvent,
} from './machine';
import {
  authenticate,
  type AuthOutcome,
  biometricOf,
  type BiometricSupport,
  detectBiometric,
} from './prompt';

export type DbResetReason = Extract<AppError, { kind: 'db_reset' }>['reason'];

type SessionStore = {
  readonly session: Session;
  readonly biometric: BiometricSupport;
  readonly dbReset: DbResetReason | null;
  /** The reviewer control "Simulate lockout": the next unlock reports lockout without prompting. */
  readonly lockoutArmed: boolean;
  /** Session-scoped (D27). Starts true at launch, so every cold start is masked, and goes true again whenever the database closes. */
  readonly amountsHidden: boolean;
};

export const sessionStore = createStore<SessionStore>(() => ({
  session: INITIAL,
  biometric: { kind: biometricOf(Platform.OS, []), ready: true },
  dbReset: null,
  lockoutArmed: false,
  amountsHidden: true,
}));

let closing: Promise<void> = Promise.resolve();
let arrival: ReturnType<typeof setTimeout> | undefined;

const CANCELLED: AuthOutcome = { ok: false, reason: 'cancelled' };

/** Returns whether the event applied. */
export function dispatch(event: SessionEvent): boolean {
  const prev = sessionStore.getState().session;
  const next = reduce(prev, event);
  if (next === prev) return false;
  const db = dbOf(prev);
  const closes = db !== null && dbOf(next) === null;
  sessionStore.setState(closes ? { session: next, amountsHidden: true } : { session: next });

  if (closes) {
    endUnlock();
    queryClient.clear();
    toast.hide();
    closing = db.close().catch(() => logEvent('db.close.failed'));
  }
  return true;
}

export async function launch(): Promise<void> {
  const [vault, biometric] = await Promise.all([hasVault().catch(() => true), detectBiometric()]);
  sessionStore.setState({ biometric });
  dispatch({ type: 'LAUNCHED', hasVault: vault });
}

/**
 * Prompts, opens the vault, then holds the asking screen for `arriveAfterMs` while Sen plays its
 * Unlock moment, before History opens.
 */
export async function unlock(arriveAfterMs = 0): Promise<AuthOutcome> {
  const { status } = sessionStore.getState().session;
  if (status !== 'locked' && status !== 'welcome') return CANCELLED;
  if (sessionStore.getState().lockoutArmed) {
    sessionStore.setState({ lockoutArmed: false });
    return { ok: false, reason: 'lockout' };
  }

  dispatch({ type: 'AUTH_START' });
  const outcome = await authenticate('Unlock Sen');
  if (!outcome.ok) {
    dispatch({ type: 'AUTH_FAIL' });
    return outcome;
  }
  mark('unlock.ok');
  try {
    const opened = await openVault();
    mark('vault.opened');
    if (opened.kind === 'reset') sessionStore.setState({ dbReset: opened.reason });
    dispatch({ type: 'UNLOCK_OK', at: Date.now(), db: opened.db });
    mark('arriving');
    clearTimeout(arrival);
    const arrive = () => {
      dispatch({ type: 'ARRIVED' });
      mark('arrived');
    };
    if (arriveAfterMs === 0) arrive();
    else arrival = setTimeout(arrive, arriveAfterMs);
    return outcome;
  } catch {
    endUnlock();
    dispatch({ type: 'AUTH_FAIL' });
    return { ok: false, reason: 'unknown' };
  }
}

/** Calls `listener` with the open database each time an unlock passes, while the asking screen holds. */
export function onArrive(listener: (db: OpenDb) => void): () => void {
  return sessionStore.subscribe(({ session }, prev) => {
    if (session.status === 'arriving' && prev.session.status !== 'arriving') listener(session.db);
  });
}

export function lockNow(): void {
  dispatch({ type: 'LOCK', reason: 'manual' });
}

/** It can only make an unlock fail. Nothing here passes a check. */
export function armLockout(): void {
  sessionStore.setState({ lockoutArmed: true });
}

export function disarmLockout(): void {
  sessionStore.setState({ lockoutArmed: false });
}

export function useLockoutArmed(): boolean {
  return useStore(sessionStore, (s) => s.lockoutArmed);
}

/**
 * Sign out of the demo, or "Not you? Start again" on Lock. Closes the database, destroys the vault (prefs
 * included), drops the previous user's notice and armed lockout, then shows Welcome. A failure returns to Lock and
 * rethrows.
 */
export async function signOut(): Promise<void> {
  if (!dispatch({ type: 'SIGN_OUT_START' })) return;
  try {
    await closing;
    await destroyVault();
  } catch (error) {
    dispatch({ type: 'SIGN_OUT_FAIL' });
    throw error;
  }
  sessionStore.setState({ dbReset: null, lockoutArmed: false });
  dispatch({ type: 'SIGN_OUT_DONE' });
}

export function dismissDbResetNotice(): void {
  sessionStore.setState({ dbReset: null });
}

export function useRouteGate(): RouteGate {
  return useStore(sessionStore, (s) => gateOf(s.session));
}

export function useDb(): OpenDb {
  const db = useStore(sessionStore, (s) => dbOf(s.session));
  const [last, setLast] = useState(db);
  if (db !== null && db !== last) setLast(db);
  const held = db ?? last;
  if (held === null)
    throw new Error('useDb is for protected screens, which mount only while unlocked.');
  return held;
}

export function useDbResetNotice(): DbResetReason | null {
  return useStore(sessionStore, (s) => s.dbReset);
}

export function useBiometric(): BiometricSupport {
  return useStore(sessionStore, (s) => s.biometric);
}

export function useSessionStatus(): Session['status'] {
  return useStore(sessionStore, (s) => s.session.status);
}
