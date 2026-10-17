import { QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryClient } from '@/services/query-client';

import { dropRevealedOnHide } from './amounts';
import { startLinkHold, takeHeldLink } from './held-link';
import { startLockTriggers, touch } from './locks';
import { LaunchCover } from './screens/launch-cover';
import { launch, useRouteGate } from './session';

void SplashScreen.preventAutoHideAsync();

export function SessionRoot({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    void launch();
    const stopLocks = startLockTriggers();
    const stopDropping = dropRevealedOnHide();
    const stopLinks = startLinkHold();
    return () => {
      stopLocks();
      stopDropping();
      stopLinks();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root} onTouchStart={touch}>
        {children}
        <HeldLinkOpener />
        <LaunchCover />
      </View>
    </QueryClientProvider>
  );
}

/** Opens a detail link that arrived while locked once the unlock lands, over History, so Back goes home. */
function HeldLinkOpener(): null {
  const gate = useRouteGate();
  useEffect(() => {
    if (gate !== 'unlocked') return;
    const path = takeHeldLink();
    if (path !== null) router.push(path);
  }, [gate]);
  return null;
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export { hideAmounts, showAmounts, useAmountsHidden } from './amounts';
export { BIOMETRIC, type BiometricCopy, refusalText } from './copy';
export { AUTH_STATES } from './fixtures';
export type { LockReason, RouteGate, StepUpAction } from './machine';
export {
  type AuthFailure,
  type AuthOverride,
  type Biometric,
  isAuthenticating,
  isAuthOverride,
  onAuthenticationEnd,
  setAuthOverride,
} from './prompt';
export type { PromptView } from './prompt-view';
export {
  armLockout,
  type DbResetReason,
  disarmLockout,
  dismissDbResetNotice,
  lockNow,
  noteDraftDroppedByLock,
  onArrive,
  recordActivity,
  signOut,
  takeDraftDropped,
  useBiometric,
  useDb,
  useDbResetNotice,
  useLockoutArmed,
  useRouteGate,
} from './session';
export { type StepUpResult, useStepUp } from './use-step-up';
export { openDeviceSettings } from './screens/device-settings';
export { LockScreen, type LockState, LockView, type LockViewProps } from './screens/lock-screen';
export {
  type PrimerState,
  PrimerScreen,
  PrimerView,
  type PrimerViewProps,
} from './screens/primer-screen';
export { WelcomeScreen, WelcomeView } from './screens/welcome-screen';
