import { useEffect } from 'react';
import { AppState } from 'react-native';

import { senGate } from './store';

/**
 * Sen holds still while the app is in the background. iOS also reports `inactive` while the Face ID
 * sheet is up, and Lock's Sen scans under that sheet, so only `background` closes the gate.
 */
export function useSenAppGate(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      senGate({ appActive: state !== 'background' }),
    );
    return () => sub.remove();
  }, []);
}
