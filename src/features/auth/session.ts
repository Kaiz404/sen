import { useState } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { toast } from '@/components/toast';
import type { ActivityEvent } from '@/models/activity';
import type { AppError } from '@/models/errors';
import { activity } from '@/services/activity-log';
import type { OpenDb } from '@/services/db';
import { logEvent } from '@/services/logger';
import { endUnlock, mark } from '@/services/perf';
import { queryClient } from '@/services/query-client';
import { type StoreCause, storeCauseOf } from '@/services/store-fault';
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
  /** Session-scoped (D27). Starts true at launch, so every cold start is masked, and goes true again whenever the database closes. */
  readonly amountsHidden: boolean;
  /** A lock unmounted a half-filled add draft. History says so once after the next unlock. */
  readonly draftDropped: boolean;
};

export const sessionStore = createStore<SessionStore>(() => ({
  session: INITIAL,
  biometric: { kind: biometricOf(Platform.OS, []), level: 'strong' },
  dbReset: null,
  amountsHidden: true,
  draftDropped: false,
}));

let closing: Promise<void> = Promise.resolve();
let arrival: ReturnType<typeof setTimeout> | undefined;

/** The check passed or failed on its own, or the vault would not open and the cause is named. */
export type UnlockOutcome =
  AuthOutcome | { readonly ok: false; readonly reason: 'store'; readonly cause: StoreCause };

const CANCELLED: AuthOutcome = { ok: false, reason: 'cancelled' };

/**
 * The one check, for unlock and for every step-up (D40): Sen picks the route from the phone and what is enrolled
 * (`routeOf`). A sensor lockout that hands over to the screen lock is a security event, so it is logged.
 */
export function check(promptMessage: string): Promise<AuthOutcome> {
  return authenticate(promptMessage, sessionStore.getState().biometric.level, (why) => {
    // A lock that arrived during the first prompt applies when it ends, so the screen lock is never asked for.
    const { session } = sessionStore.getState();
    if (session.status === 'stepUp' && session.lockPending !== undefined) return false;
    if (why === 'lockout') recordActivity({ code: 'auth.failed', reason: 'lockout' });
    return true;
  });
}

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
    if (next.status === 'locked' && next.reason !== 'launch' && next.reason !== 'signout')
      activity.record(db, { code: 'lock.locked', reason: next.reason });
    queryClient.clear();
    toast.hide();
    closing = db.close().catch(() => logEvent('db.close.failed'));
  }
  return true;
}

/** Records into the open vault, or holds the event for the next unlock when there is none. */
export function recordActivity(event: ActivityEvent): void {
  activity.record(dbOf(sessionStore.getState().session), event);
}

export async function launch(): Promise<void> {
  const [vault, biometric] = await Promise.all([hasVault().catch(() => true), detectBiometric()]);
  sessionStore.setState({ biometric });
  dispatch({ type: 'LAUNCHED', hasVault: vault });
}

/** Lock reads biometrics once at launch, so a change made in the phone's settings is picked up here. */
export async function refreshBiometric(): Promise<void> {
  const prev = sessionStore.getState().biometric;
  const next = await detectBiometric(prev);
  if (next.kind !== prev.kind || next.level !== prev.level)
    sessionStore.setState({ biometric: next });
}

/**
 * Checks, opens the vault, then holds the asking screen for `arriveAfterMs` while Sen plays its
 * Unlock moment, before History opens.
 */
export async function unlock(arriveAfterMs = 0): Promise<UnlockOutcome> {
  const { status } = sessionStore.getState().session;
  if (status !== 'locked' && status !== 'welcome') return CANCELLED;

  dispatch({ type: 'AUTH_START' });
  const outcome = await check('Unlock Sen');
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
    activity.flush(opened.db);
    activity.record(opened.db, { code: 'auth.unlocked' });
    clearTimeout(arrival);
    const arrive = () => {
      dispatch({ type: 'ARRIVED' });
      mark('arrived');
    };
    if (arriveAfterMs === 0) arrive();
    else arrival = setTimeout(arrive, arriveAfterMs);
    return outcome;
  } catch (error) {
    endUnlock();
    dispatch({ type: 'AUTH_FAIL' });
    const cause = storeCauseOf(error);
    logEvent(`vault.open_failed.${cause}`);
    return { ok: false, reason: 'store', cause };
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

/**
 * Sign out of the demo, or "Not you? Start again" on Lock. Closes the database, destroys the vault (prefs
 * included), drops the previous user's notice, then shows Welcome. A failure returns to Lock and
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
  sessionStore.setState({ dbReset: null, draftDropped: false });
  activity.discard();
  dispatch({ type: 'SIGN_OUT_DONE' });
}

/** Called as the add flow unmounts. Only a lock leaves a draft dropped, so a close or a save sets nothing. */
export function noteDraftDroppedByLock(): void {
  if (sessionStore.getState().session.status === 'locked')
    sessionStore.setState({ draftDropped: true });
}

/** True once per drop. */
export function takeDraftDropped(): boolean {
  const dropped = sessionStore.getState().draftDropped;
  if (dropped) sessionStore.setState({ draftDropped: false });
  return dropped;
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
