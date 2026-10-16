import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { toast } from '@/components/toast';
import {
  type AuthFailure,
  BIOMETRIC,
  type BiometricCopy,
  signOut,
  useBiometric,
  useStepUp,
} from '@/features/auth';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

import { eraseEverything } from './erase';

export type ErasePhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'erasing' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> };

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const REFUSED: Readonly<Record<Exclude<AuthFailure, 'cancelled'>, (name: string) => string>> = {
  mismatch: (name) => `${capital(name)} didn’t match. Nothing was erased.`,
  lockout: () => 'Too many tries. Nothing was erased. Use your device passcode next time.',
  not_set_up: (name) => `${capital(name)} is off. Nothing was erased.`,
  unavailable: (name) => `${capital(name)} isn’t available right now. Nothing was erased.`,
  unknown: () => 'Something went wrong with the check. Nothing was erased.',
};

export function EraseView({
  sensor,
  phase,
  onErase,
  onCancel,
}: {
  readonly sensor: BiometricCopy;
  readonly phase: ErasePhase;
  readonly onErase: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const busy = phase.kind === 'checking' || phase.kind === 'erasing';
  const label =
    phase.kind === 'checking'
      ? 'Checking it’s you…'
      : phase.kind === 'erasing'
        ? 'Erasing…'
        : phase.kind === 'refused'
          ? `Try again with ${sensor.name}`
          : `Erase with ${sensor.name}`;
  return (
    <View style={styles.sheet}>
      <Sen pose="worried" size={56} label="Sen, worried" />
      <Text accessibilityRole="header" style={styles.title}>
        Erase everything on this phone?
      </Text>
      <Text style={styles.body}>
        {`Sen destroys the vault key, so every row you added, the security log and your settings are gone for good. It asks for ${sensor.name} first. You start again at Welcome, and the sample transactions load fresh.`}
      </Text>
      {phase.kind === 'refused' && (
        <Text accessibilityRole="alert" style={styles.problem}>
          {REFUSED[phase.reason](sensor.name)}
        </Text>
      )}
      <Key
        tone="loud"
        size="xlarge"
        icon="delete-forever-outline"
        label={label}
        disabled={busy}
        onPress={onErase}
      />
      <Key
        tone="outline"
        size="large"
        label="Cancel"
        disabled={phase.kind === 'erasing'}
        onPress={onCancel}
      />
    </View>
  );
}

export function EraseSheet(): ReactNode {
  const router = useRouter();
  const sensor = BIOMETRIC[useBiometric().kind];
  const confirm = useStepUp('erase');
  const [phase, setPhase] = useState<ErasePhase>({ kind: 'ready' });

  const onErase = async () => {
    if (phase.kind === 'checking' || phase.kind === 'erasing') return;
    setPhase({ kind: 'checking' });
    const outcome = await eraseEverything(confirm, async () => {
      setPhase({ kind: 'erasing' });
      await signOut();
    });
    switch (outcome.kind) {
      case 'erased':
        return;
      case 'cancelled':
        setPhase({ kind: 'ready' });
        return;
      case 'refused':
        setPhase({ kind: 'refused', reason: outcome.reason });
        return;
      case 'failed':
        toast.show({
          title: 'Couldn’t finish erasing',
          detail: 'On the lock screen, tap Start again to finish.',
        });
        return;
    }
  };

  return (
    <EraseView
      sensor={sensor}
      phase={phase}
      onErase={() => void onErase()}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  sheet: {
    gap: 12,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 20,
    backgroundColor: theme.colors.canvas,
  },
  title: { ...type.words(30), color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted },
  problem: { fontSize: 14, fontWeight: '600', color: theme.colors.danger },
}));
