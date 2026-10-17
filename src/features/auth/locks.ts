import { AppState, type AppStateStatus } from 'react-native';

import { readPref } from '@/services/prefs';

import { type Answer, isAuthenticating, onAuthenticationEnd, promptAppState } from './prompt';
import { dispatch, refreshBiometric } from './session';

export const TICK_MS = 15_000;
const MINUTE = 60_000;

let lastTouch = Date.now();
let backgroundedAt: number | null = null;
/**
 * When Sen left `active` while its own prompt was up. The screen-lock screen on Android 9 and 10, and possibly the
 * credential UI on 11 and later, takes Sen to the background, so that is not a trip away: starting the re-lock window
 * would lock a step-up the moment the user came back, and with "Right away" step-up could never work. The prompt's end
 * decides (see `onPromptEnd`).
 */
let awayDuringPrompt: number | null = null;
/** The last app state heard, because a prompt can end after the state changed. */
let lastAppState: AppStateStatus = 'active';

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

/**
 * Only `background` starts the re-lock window, because iOS sends `inactive` while the Face ID sheet is up. While Sen's
 * own prompt is up, on any route, it does not start (see `awayDuringPrompt`).
 */
function onAppState(state: AppStateStatus): void {
  lastAppState = state;
  promptAppState(state);
  if (state === 'active') void refreshBiometric();
  if (state === 'background') {
    if (isAuthenticating()) awayDuringPrompt ??= Date.now();
    else backgroundedAt = Date.now();
  } else if (state === 'active' && backgroundedAt !== null) {
    lockIfAwayTooLong();
    backgroundedAt = null;
    lastTouch = Date.now();
  }
}

/**
 * A prompt that passed is the user being here, so the window never ran. One that ended otherwise, such as a cancel
 * after Home, applies the away check for the time spent away, or keeps timing it if Sen is still in the background.
 * A sensor lockout hands over to a second prompt, so it waits for that one.
 */
function onPromptEnd(answer: Answer): void {
  if (awayDuringPrompt === null) return;
  if (answer.ok) {
    awayDuringPrompt = null;
    lastTouch = Date.now();
    return;
  }
  if (answer.reason === 'lockout') return;
  backgroundedAt = awayDuringPrompt;
  awayDuringPrompt = null;
  if (lastAppState !== 'active') return;
  lockIfAwayTooLong();
  backgroundedAt = null;
  lastTouch = Date.now();
}

function onTick(): void {
  if (backgroundedAt !== null) return;
  // Using Sen's own prompt is activity, though the touches land in the system's UI.
  if (isAuthenticating()) {
    lastTouch = Date.now();
    return;
  }
  const idle = Date.now() - lastTouch;
  if (clockSetBack(idle) || idle >= readPref('idleLock') * MINUTE) {
    dispatch({ type: 'LOCK', reason: 'idle' });
  }
}

export function startLockTriggers(): () => void {
  lastAppState = 'active';
  lastTouch = Date.now();
  const timer = setInterval(onTick, TICK_MS);
  const appState = AppState.addEventListener('change', onAppState);
  const stopPrompt = onAuthenticationEnd(onPromptEnd);
  return () => {
    clearInterval(timer);
    appState.remove();
    stopPrompt();
    awayDuringPrompt = null;
  };
}
