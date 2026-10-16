import { useState } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { toast } from '@/components/toast';
import type { AppError } from '@/models/errors';
import type { OpenDb } from '@/services/db';
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
};

export const sessionStore = createStore<SessionStore>(() => ({
  session: INITIAL,
  biometric: { kind: biometricOf(Platform.OS, []), ready: true },
  dbReset: null,
}));

let closing: Promise<void> = Promise.resolve();
let lockoutArmed = false;

const CANCELLED: AuthOutcome = { ok: false, reason: 'cancelled' };

/** Returns whether the event applied. */
export function dispatch(event: SessionEvent): boolean {
  const prev = sessionStore.getState().session;
  const next = reduce(prev, event);
  if (next === prev) return false;
  sessionStore.setState({ session: next });

  const db = dbOf(prev);
  if (db !== null && dbOf(next) === null) {
    queryClient.clear();
    toast.hide();
    closing = db.close();
  }
  return true;
}

export async function launch(): Promise<void> {
  const [vault, biometric] = await Promise.all([hasVault().catch(() => true), detectBiometric()]);
  sessionStore.setState({ biometric });
  dispatch({ type: 'LAUNCHED', hasVault: vault });
}

export async function unlock(): Promise<AuthOutcome> {
  const { status } = sessionStore.getState().session;
  if (status !== 'locked' && status !== 'welcome') return CANCELLED;
  if (lockoutArmed) {
    lockoutArmed = false;
    return { ok: false, reason: 'lockout' };
  }

  dispatch({ type: 'AUTH_START' });
  const outcome = await authenticate('Unlock Sen');
  if (!outcome.ok) {
    dispatch({ type: 'AUTH_FAIL' });
    return outcome;
  }
  try {
    const opened = await openVault();
    if (opened.kind === 'reset') sessionStore.setState({ dbReset: opened.reason });
    dispatch({ type: 'UNLOCK_OK', at: Date.now(), db: opened.db });
    return outcome;
  } catch {
    dispatch({ type: 'AUTH_FAIL' });
    return { ok: false, reason: 'unknown' };
  }
}

export function lockNow(): void {
  dispatch({ type: 'LOCK', reason: 'manual' });
}

export function armLockout(): void {
  lockoutArmed = true;
}

/**
 * Sign out of the demo, or "Not you? Start again" on Lock. Closes the database, destroys the vault (prefs
 * included), then shows Welcome. A failure returns to Lock and rethrows.
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
  sessionStore.setState({ dbReset: null });
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
