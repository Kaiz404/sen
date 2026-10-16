import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { useStore } from 'zustand';

import { SenLaunch } from '@/features/sen';

import { finishLaunch, launchStore } from '../launch';
import { useRouteGate, useSessionStatus } from '../session';

/**
 * If the first screen hasn't reported its hero by then, it isn't Lock or Welcome (a dev deep link),
 * so the launch is skipped.
 */
const NO_TARGET_MS = 500;

/**
 * MAL2 over the first screen at cold start. The native splash (plain ink) stays up until the launch
 * covers the screen, so the hand-over is invisible. It hands off into Lock's masked Sen, or into
 * Welcome's Sen, which then waves hello.
 */
export function LaunchCover(): ReactNode {
  const launching = useSessionStatus() === 'launching';
  const gate = useRouteGate();
  const target = useStore(launchStore, (s) => s.target);
  const done = useStore(launchStore, (s) => s.done);

  useEffect(() => {
    if (launching) return;
    if (done || target !== null) return SplashScreen.hide();
    const timer = setTimeout(finishLaunch, NO_TARGET_MS);
    return () => clearTimeout(timer);
  }, [launching, done, target]);

  if (launching || done || target === null) return null;
  return (
    <SenLaunch
      target={target}
      rest={gate === 'welcome' ? 'idle' : 'masked'}
      ready
      onDone={finishLaunch}
    />
  );
}
