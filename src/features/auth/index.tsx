import { QueryClientProvider } from '@tanstack/react-query';
import { authenticateAsync } from 'expo-local-authentication';
import { type ReactNode, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { StubScreen } from '@/features/stub';
import { queryClient } from '@/services/query-client';
import { type } from '@/theme/type';

/**
 * Which half of the route tree is mounted. One value, not two booleans, so "unlocked but never onboarded"
 * can't be expressed. Lane 2c derives it from the session reducer:
 *   first run, until the primer finishes  → 'welcome'
 *   locked, or authenticating to unlock   → 'locked'
 *   unlocked, revealed, stepUp            → 'unlocked'
 */
export type RouteGate = 'welcome' | 'locked' | 'unlocked';

// Phase 1 stub session: starts locked, and the stub Lock screen unlocks it. Lane 2c replaces it.
let gate: RouteGate = 'locked';
const listeners = new Set<() => void>();
function setGate(next: RouteGate) {
  gate = next;
  listeners.forEach((notify) => notify());
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The root layout's only read of the session. */
export function useRouteGate(): RouteGate {
  return useSyncExternalStore(subscribe, () => gate);
}

/**
 * Everything whose lifetime is the session, mounted once inside the root layout: the query cache that lock
 * clears, the AppState and idle listeners, and the iOS privacy cover. Phase 1 mounts the query cache.
 */
export function SessionRoot({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function LockScreen(): ReactNode {
  const [failed, setFailed] = useState(false);

  const unlock = async () => {
    const result = await authenticateAsync({
      promptMessage: 'Unlock Sen',
      biometricsSecurityLevel: 'strong',
      disableDeviceFallback: false,
    });
    if (result.success) setGate('unlocked');
    else setFailed(result.error === 'authentication_failed');
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>SEN</Text>
      {failed && <Text style={styles.hint}>Not quite.</Text>}
      <Pressable accessibilityRole="button" onPress={unlock} style={styles.key}>
        <Text style={styles.keyLabel}>UNLOCK</Text>
      </Pressable>
    </View>
  );
}

export function WelcomeScreen(): ReactNode {
  return <StubScreen name="WELCOME" />;
}

export function PrimerScreen(): ReactNode {
  return <StubScreen name="PRIMER" />;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: theme.colors.canvas,
  },
  title: { ...type.words(72), color: theme.colors.ink },
  hint: { ...type.mono(15), color: theme.colors.inkMuted },
  key: {
    minHeight: 56,
    paddingHorizontal: 32,
    justifyContent: 'center',
    borderRadius: theme.shape.keyRadius,
    borderWidth: theme.shape.keyBorder,
    borderColor: theme.colors.onPastel,
    backgroundColor: theme.colors.lemon,
  },
  keyLabel: { ...type.words(22), color: theme.colors.onPastel },
}));
