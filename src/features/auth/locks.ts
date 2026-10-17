import { AppState, type AppStateStatus } from 'react-native';

import { readPref } from '@/services/prefs';

import { promptAppState } from './prompt';
import { dispatch, refreshBiometric } from './session';

export const TICK_MS = 15_000;
const MINUTE = 60_000;

let lastTouch = Date.now();
let backgroundedAt: number | null = null;

export function touch(): void {
  lastTouch = Date.now();
}

const clockSetBack = (elapsed: number) => elapsed < 0;

/**
 * Locks if the app has been in the background past the re-lock window. Runs on `active`, and earlier for a
 * link, because both platforms deliver the link before the app turns active.
 */
export function lockIfAwayTooLong(): void {
  if (backgroundedAt === null) return;
  const away = Date.now() - backgroundedAt;
  if (clockSetBack(away) || away > readPref('relockAfter') * MINUTE) {
    dispatch({ type: 'LOCK', reason: 'background' });
  }
}

/** Only `background` starts the re-lock window, because iOS sends `inactive` while the Face ID sheet is up. */
function onAppState(state: AppStateStatus): void {
  promptAppState(state);
  if (state === 'active') void refreshBiometric();
  if (state === 'background') {
    backgroundedAt = Date.now();
  } else if (state === 'active' && backgroundedAt !== null) {
    lockIfAwayTooLong();
    backgroundedAt = null;
    lastTouch = Date.now();
  }
}

function onTick(): void {
  if (backgroundedAt !== null) return;
  const idle = Date.now() - lastTouch;
  if (clockSetBack(idle) || idle >= readPref('idleLock') * MINUTE) {
    dispatch({ type: 'LOCK', reason: 'idle' });
  }
}

export function startLockTriggers(): () => void {
  lastTouch = Date.now();
  const timer = setInterval(onTick, TICK_MS);
  const appState = AppState.addEventListener('change', onAppState);
  return () => {
    clearInterval(timer);
    appState.remove();
  };
}
