import { QueryClientProvider } from '@tanstack/react-query';
import { authenticateAsync } from 'expo-local-authentication';
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { StubScreen } from '@/features/stub';
import { queryClient } from '@/services/query-client';
import { type } from '@/theme/type';

export type RouteGate = 'welcome' | 'locked' | 'unlocked';

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

export function useRouteGate(): RouteGate {
  return useSyncExternalStore(subscribe, () => gate);
}

export function SessionRoot({ children }: { children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function LockScreen(): ReactNode {
  const [failed, setFailed] = useState(false);
  const isAuthenticatingRef = useRef(false);

  const unlock = async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    try {
      const result = await authenticateAsync({
        promptMessage: 'Unlock Sen',
        biometricsSecurityLevel: 'strong',
        disableDeviceFallback: false,
      });
      if (result.success) setGate('unlocked');
      else setFailed(result.error === 'authentication_failed');
    } finally {
      isAuthenticatingRef.current = false;
    }
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
