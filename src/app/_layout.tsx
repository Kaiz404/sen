import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { NavScrim } from '@/components/nav-scrim';
import { ToastHost } from '@/components/toast';
import { SessionRoot, useRouteGate } from '@/features/auth';
import { PrivacyCover, useScreenGuard } from '@/features/security';
import { useSenAppGate } from '@/features/sen';
import { useSenMotionPreference } from '@/features/settings';
import { useHistoryPrefetch } from '@/features/transactions';
import { MotionPolicyRoot } from '@/motion/policy';

const SHEET_RADIUS = 30;
const SHEET_ELEVATION = 8;

/**
 * The board's sheet: 30 pt top corners on both platforms and the native grabber on iOS. Android never reads
 * `sheetGrabberVisible`, so `SheetSurface` draws its handle. The surface follows the theme.
 */
function sheetOptions(surface: string) {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: SHEET_RADIUS,
    sheetElevation: SHEET_ELEVATION,
    contentStyle: { backgroundColor: surface },
  } as const;
}

export default function RootLayout() {
  const gate = useRouteGate();
  const motion = useSenMotionPreference();
  const { rt, theme } = useUnistyles();
  const sheet = useMemo(() => sheetOptions(theme.colors.canvas), [theme.colors.canvas]);
  useScreenGuard();
  useSenAppGate();
  useHistoryPrefetch();

  return (
    <GestureHandlerRootView style={styles.root}>
      <MotionPolicyRoot preference={motion}>
        <SessionRoot>
          <StatusBar style={rt.themeName === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={gate === 'unlocked'}>
              <Stack.Screen name="index" />
              <Stack.Screen name="transaction/[id]/index" />
              <Stack.Screen name="transaction/[id]/delete" options={sheet} />
              <Stack.Screen name="add" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="settings/index" />
              <Stack.Screen name="settings/activity" />
              <Stack.Screen name="settings/privacy" options={sheet} />
              <Stack.Screen name="settings/sign-out" options={sheet} />
              <Stack.Screen name="settings/reset-demo" options={sheet} />
              <Stack.Screen name="settings/erase" options={sheet} />
              <Stack.Screen name="+not-found" />
            </Stack.Protected>
            <Stack.Protected guard={gate === 'welcome'}>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="primer" />
            </Stack.Protected>
            <Stack.Protected guard={gate === 'locked'}>
              <Stack.Screen name="lock" />
            </Stack.Protected>
            <Stack.Protected guard={__DEV__}>
              <Stack.Screen name="dev/states" />
            </Stack.Protected>
          </Stack>
          <NavScrim hidden={gate === 'locked'} />
          <ToastHost />
          <PrivacyCover />
        </SessionRoot>
      </MotionPolicyRoot>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.canvas },
}));
export { ErrorBoundary } from '@/features/errors';
