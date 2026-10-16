import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type IconName, Key } from '@/components/key';
import { toast } from '@/components/toast';
import { type Biometric, signOut, useBiometric, useDb } from '@/features/auth';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

import { resetDemo } from './actions';
import { BIOMETRIC_ICON, BIOMETRIC_NAME, capital } from './copy';

type Pledge = { readonly icon: IconName; readonly title: string; readonly body: string };

function pledges(biometric: Biometric): readonly Pledge[] {
  const name = BIOMETRIC_NAME[biometric];
  return [
    {
      icon: 'eye-off-outline',
      title: 'Masked by default',
      body: 'Every amount shows as RM and four coins until you ask.',
    },
    {
      icon: BIOMETRIC_ICON[biometric],
      title: `${capital(name)} to show them`,
      body: `Showing amounts asks for ${name} every time. Hiding them never asks.`,
    },
    {
      icon: 'lock-outline',
      title: 'Locked when you leave',
      body: 'Sen locks after you leave it or stop touching it. Change both under Security.',
    },
    {
      icon: 'check',
      title: 'Nothing leaves this phone',
      body: 'Your history is stored encrypted, with the key in the Keychain or Keystore.',
    },
  ];
}

export function PrivacyView({
  biometric,
  onClose,
}: {
  readonly biometric: Biometric;
  readonly onClose: () => void;
}): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View style={styles.sheet}>
      <View style={styles.top}>
        <Sen pose="masked" size={56} label="Sen, eyes closed" />
        <Text style={styles.caption}>ABOUT · PRIVACY</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        How Sen keeps amounts private
      </Text>
      {pledges(biometric).map((p) => (
        <View key={p.title} style={styles.promise}>
          <MaterialCommunityIcons name={p.icon} size={20} color={theme.colors.ink} />
          <View style={styles.promiseText}>
            <Text style={styles.promiseTitle}>{p.title}</Text>
            <Text style={styles.body}>{p.body}</Text>
          </View>
        </View>
      ))}
      <Key tone="lemon" size="large" label="Got it" onPress={onClose} />
    </View>
  );
}

export function PrivacySheet(): ReactNode {
  const router = useRouter();
  return <PrivacyView biometric={useBiometric().kind} onClose={() => router.back()} />;
}

export function SignOutView({
  onSignOut,
  onCancel,
}: {
  readonly onSignOut: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <View style={styles.sheet}>
      <Sen pose="worried" size={56} label="Sen, worried" />
      <Text accessibilityRole="header" style={styles.title}>
        Sign out of demo?
      </Text>
      <Text style={styles.body}>
        Sen destroys the vault key, so the rows you added are gone for good. Your settings reset and
        you start again at Welcome.
      </Text>
      <Key tone="loud" size="xlarge" icon="logout" label="Sign out" onPress={onSignOut} />
      <Key tone="outline" size="large" label="Cancel" onPress={onCancel} />
    </View>
  );
}

export function SignOutSheet(): ReactNode {
  const router = useRouter();
  return (
    <SignOutView
      // A sign-out that fails lands on Lock, whose "Start again" tries once more.
      onSignOut={() =>
        void signOut().catch(() =>
          toast.show({
            title: 'Couldn’t sign out',
            detail: 'Nothing was erased. Try Start again.',
          }),
        )
      }
      onCancel={() => router.back()}
    />
  );
}

export type ResetPhase = 'ready' | 'resetting' | 'failed';

export function ResetDemoView({
  phase,
  onReset,
  onCancel,
}: {
  readonly phase: ResetPhase;
  readonly onReset: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <View style={styles.sheet}>
      <Sen pose="look" size={56} label="Sen, looking at the reset question" />
      <Text accessibilityRole="header" style={styles.title}>
        Reset demo data?
      </Text>
      <Text style={styles.body}>
        The sample transactions start over and the reviewer controls go back to Normal. Rows you
        added, your theme and your security choices stay.
      </Text>
      {phase === 'failed' && (
        <Text accessibilityRole="alert" style={styles.failed}>
          Sen couldn’t reset the sample data. Nothing changed. Try again.
        </Text>
      )}
      <Key
        tone="loud"
        size="xlarge"
        icon="refresh"
        label={phase === 'resetting' ? 'Resetting…' : 'Reset demo data'}
        disabled={phase === 'resetting'}
        onPress={onReset}
      />
      <Key tone="outline" size="large" label="Cancel" onPress={onCancel} />
    </View>
  );
}

export function ResetDemoSheet(): ReactNode {
  const db = useDb();
  const router = useRouter();
  const [phase, setPhase] = useState<ResetPhase>('ready');
  const onReset = () => {
    if (phase === 'resetting') return;
    setPhase('resetting');
    resetDemo(db).then(
      () => router.dismissTo('/'),
      () => setPhase('failed'),
    );
  };
  return <ResetDemoView phase={phase} onReset={onReset} onCancel={() => router.back()} />;
}

const styles = StyleSheet.create((theme, rt) => ({
  sheet: {
    gap: 12,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 20,
    backgroundColor: theme.colors.canvas,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  title: { ...type.words(30), color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted },
  promise: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  promiseText: { flex: 1, gap: 2 },
  promiseTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  failed: { fontSize: 14, fontWeight: '600', color: theme.colors.danger },
}));
