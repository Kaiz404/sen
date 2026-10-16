import { useState } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

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

export function dispatch(event: SessionEvent): void {
  const prev = sessionStore.getState().session;
  const next = reduce(prev, event);
  if (next === prev) return;
  sessionStore.setState({ session: next });

  const db = dbOf(prev);
  if (db !== null && dbOf(next) === null) {
    queryClient.clear();
    closing = db.close();
  }
}

/** A failed vault check counts as a vault, so launch never offers Welcome over existing data. */
export async function launch(): Promise<void> {
  const [vault, biometric] = await Promise.all([hasVault().catch(() => true), detectBiometric()]);
  sessionStore.setState({ biometric });
  dispatch({ type: 'LAUNCHED', hasVault: vault });
}

/** Unlocks from Lock, or creates the vault from the first-run primer. Never called on resume. */
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

/** The reviewer control "Simulate Face ID lockout". The next unlock reports lockout without prompting. */
export function armLockout(): void {
  lockoutArmed = true;
}

/** Sign out of the demo, or "Not you? Start again" on Lock. Locks, destroys the vault (prefs included), then shows Welcome. */
export async function signOut(): Promise<void> {
  const { status } = sessionStore.getState().session;
  if (status !== 'locked' && status !== 'unlocked') return;
  dispatch({ type: 'LOCK', reason: 'signout' });
  await closing;
  await destroyVault();
  sessionStore.setState({ dbReset: null });
  dispatch({ type: 'RESET' });
}

export function dismissDbResetNotice(): void {
  sessionStore.setState({ dbReset: null });
}

export function useRouteGate(): RouteGate {
  return useStore(sessionStore, (s) => gateOf(s.session));
}

/**
 * The open database, for protected screens. A screen still animating out after a lock keeps the closed handle,
 * so its late queries reject instead of the screen throwing mid-transition.
 */
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

export function useIsAuthenticating(): boolean {
  return useStore(sessionStore, (s) => s.session.status === 'authenticating');
}
