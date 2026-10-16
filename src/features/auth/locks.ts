import { AppState, type AppStateStatus } from 'react-native';

import { readPref } from '@/services/prefs';

import { isAuthenticatingRef } from './prompt';
import { dispatch } from './session';

export const TICK_MS = 15_000;
const MINUTE = 60_000;

let lastTouch = Date.now();
let backgroundedAt: number | null = null;

export function touch(): void {
  lastTouch = Date.now();
}

/**
 * Only `background` starts the re-lock window. iOS sends `inactive` while the Face ID sheet is up, and a prompt
 * that leaves the app (the Android passcode screen on older versions) must not count as leaving either.
 */
function onAppState(state: AppStateStatus): void {
  const now = Date.now();
  if (state === 'background') {
    if (!isAuthenticatingRef.current) backgroundedAt = now;
  } else if (state === 'active' && backgroundedAt !== null) {
    if (now - backgroundedAt > readPref('relockAfter') * MINUTE) {
      dispatch({ type: 'LOCK', reason: 'background' });
    }
    backgroundedAt = null;
    lastTouch = now;
  }
}

function onTick(): void {
  if (backgroundedAt !== null) return;
  if (Date.now() - lastTouch >= readPref('idleLock') * MINUTE) {
    dispatch({ type: 'LOCK', reason: 'idle' });
  }
}

/** Wires AppState and the 15 s idle tick. */
export function startLockTriggers(): () => void {
  lastTouch = Date.now();
  const timer = setInterval(onTick, TICK_MS);
  const appState = AppState.addEventListener('change', onAppState);
  return () => {
    clearInterval(timer);
    appState.remove();
  };
}
