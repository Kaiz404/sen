import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryClient } from '@/services/query-client';

import { dropRevealedOnHide } from './amounts';
import { startLockTriggers, touch } from './locks';
import { LaunchCover } from './screens/launch-cover';
import { launch } from './session';

void SplashScreen.preventAutoHideAsync();

export function SessionRoot({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    void launch();
    const stopLocks = startLockTriggers();
    const stopDropping = dropRevealedOnHide();
    return () => {
      stopLocks();
      stopDropping();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root} onTouchStart={touch}>
        {children}
        <LaunchCover />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export { hideAmounts, showAmounts, useAmountsHidden } from './amounts';
export { AUTH_STATES } from './fixtures';
export type { LockReason, RouteGate, StepUpAction } from './machine';
export {
  type AuthFailure,
  type AuthOverride,
  type Biometric,
  isAuthOverride,
  setAuthOverride,
} from './prompt';
export type { PromptView } from './prompt-view';
export {
  armLockout,
  type DbResetReason,
  dismissDbResetNotice,
  lockNow,
  onArrive,
  signOut,
  useBiometric,
  useDb,
  useDbResetNotice,
  useRouteGate,
} from './session';
export { type StepUpResult, useStepUp } from './use-step-up';
export { LockScreen, type LockState, LockView, type LockViewProps } from './screens/lock-screen';
export {
  type PrimerState,
  PrimerScreen,
  PrimerView,
  type PrimerViewProps,
} from './screens/primer-screen';
export { WelcomeScreen, WelcomeView } from './screens/welcome-screen';
