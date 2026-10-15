import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

import { ToastHost } from '@/components/toast';
import { SessionRoot, useRouteGate } from '@/features/auth';
import { useScreenGuard } from '@/features/security';
import { useSenMotionPreference } from '@/features/settings';
import { MotionPolicyRoot } from '@/motion/policy';

const sheet = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
} as const;

export default function RootLayout() {
  const gate = useRouteGate();
  const motion = useSenMotionPreference();
  useScreenGuard();

  return (
    <GestureHandlerRootView style={styles.root}>
      <MotionPolicyRoot preference={motion}>
        <SessionRoot>
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
          <ToastHost />
        </SessionRoot>
      </MotionPolicyRoot>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.canvas },
}));
