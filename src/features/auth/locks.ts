import { AppState, type AppStateStatus } from 'react-native';

import { readPref } from '@/services/prefs';

import { dispatch } from './session';

export const TICK_MS = 15_000;
const MINUTE = 60_000;

let lastTouch = Date.now();
let backgroundedAt: number | null = null;

export function touch(): void {
  lastTouch = Date.now();
}

/**
 * Only `background` starts the re-lock window, because iOS sends `inactive` while the Face ID sheet is up. A
 * prompt still open on return (the Android passcode screen leaves the app) does not lock, because the reducer
 * ignores `LOCK` while a prompt holds.
 */
function onAppState(state: AppStateStatus): void {
  const now = Date.now();
  if (state === 'background') {
    backgroundedAt = now;
  } else if (state === 'active' && backgroundedAt !== null) {
    const away = now - backgroundedAt;
    if (away > readPref('relockAfter') * MINUTE) {
      dispatch({ type: 'LOCK', reason: 'background' });
    }
    backgroundedAt = null;
    lastTouch = now;
  }
}

function onTick(): void {
  if (backgroundedAt !== null) return;
  const idle = Date.now() - lastTouch;
  if (idle >= readPref('idleLock') * MINUTE) {
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
