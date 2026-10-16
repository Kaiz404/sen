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

const clockSetBack = (elapsed: number) => elapsed < 0;

/** Only `background` starts the re-lock window, because iOS sends `inactive` while the Face ID sheet is up. */
function onAppState(state: AppStateStatus): void {
  const now = Date.now();
  if (state === 'background') {
    backgroundedAt = now;
  } else if (state === 'active' && backgroundedAt !== null) {
    const away = now - backgroundedAt;
    if (clockSetBack(away) || away > readPref('relockAfter') * MINUTE) {
      dispatch({ type: 'LOCK', reason: 'background' });
    }
    backgroundedAt = null;
    lastTouch = now;
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
