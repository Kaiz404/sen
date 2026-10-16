import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { logEvent } from '@/services/logger';

export const GUARD_KEY = 'sen-screen-guard';

/** Release builds always guard. Dev builds don't, so agents can screenshot them. */
export function guardsScreens(): boolean {
  return !__DEV__;
}

function engage(): void {
  preventScreenCaptureAsync(GUARD_KEY).catch(() => logEvent('guard.failed'));
}

/**
 * Blocks screenshots, screen recording and the recents preview for the whole app (Android FLAG_SECURE, iOS
 * secure canvas). expo-screen-capture skips the native call while the key is active, so a foreground event only
 * retries a block that failed. An Activity that Android recreates unmounts and mounts this hook again, which
 * sets the flag on the new window.
 */
export function useScreenGuard(): void {
  useEffect(() => {
    if (!guardsScreens()) return;
    engage();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') engage();
    });
    return () => {
      appState.remove();
      allowScreenCaptureAsync(GUARD_KEY).catch(() => logEvent('guard.failed'));
    };
  }, []);
}
