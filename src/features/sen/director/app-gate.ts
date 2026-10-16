import { useEffect } from 'react';
import { AppState } from 'react-native';

import { releaseSenScroll, senGate } from './store';

/**
 * Sen holds still while the app is in the background. iOS also reports `inactive` while the Face ID
 * sheet is up, and Lock's Sen scans under that sheet, so only `background` closes the gate. Nothing
 * scrolls in the background, so it also ends any scroll whose end event the app missed.
 */
export function useSenAppGate(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state !== 'background';
      if (!active) releaseSenScroll();
      senGate({ appActive: active });
    });
    return () => sub.remove();
  }, []);
}
