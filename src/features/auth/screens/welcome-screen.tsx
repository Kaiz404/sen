import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { type IconName, Key } from '@/components/key';
import { ReceiptSlip } from '@/components/receipt-slip';
import { type } from '@/theme/type';

import { Hero } from './parts';

export function WelcomeScreen(): ReactNode {
  const router = useRouter();
  return <WelcomeView onContinue={() => router.push('/primer')} />;
}

type Pledge = {
  readonly tile: 'lemon' | 'lilac' | 'mint';
  readonly icon: IconName | null;
  readonly text: string;
};

const PROMISES: readonly Pledge[] = [
  { tile: 'lemon', icon: null, text: 'Amounts stay hidden until you say so.' },
  { tile: 'lilac', icon: 'face-recognition', text: 'Face ID or fingerprint to reveal them.' },
  { tile: 'mint', icon: 'cellphone', text: 'Everything stays on this phone.' },
];

export function WelcomeView({ onContinue }: { readonly onContinue: () => void }): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Hero
        kind="welcome"
        title={['Meet', 'Sen.']}
        body="A coin that keeps its eyes shut on your money until you ask."
        sen={{ pose: 'happy', label: 'Sen, waving hello' }}
      />
      <View style={styles.actions}>
        <ReceiptSlip>
          <View style={styles.slip}>
            <Text accessibilityRole="header" style={styles.caption}>
              THREE THINGS SEN PROMISES
            </Text>
            {PROMISES.map((promise, index) => (
              <View key={promise.tile} style={[styles.promise, index > 0 && styles.promiseRule]}>
                <Text accessible={false} style={styles.index}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={[styles.tile, styles[promise.tile]]}>
                  {promise.icon === null ? (
                    <Amount value={null} size="tile" surface="pastel" />
                  ) : (
                    <MaterialCommunityIcons
                      name={promise.icon}
                      size={24}
                      color={theme.colors.onPastel}
                    />
                  )}
                </View>
                <Text style={styles.promiseText}>{promise.text}</Text>
              </View>
            ))}
            <Text style={styles.stamp}>SIMULATED DATA · NO REAL ACCOUNT</Text>
          </View>
        </ReceiptSlip>
        <View style={styles.cta}>
          <Key
            testID="continue"
            tone="lemon"
            size="xlarge"
            icon="chevron-right"
            iconPosition="end"
            label="Continue as demo user"
            onPress={onContinue}
          />
          <Text style={styles.small}>
            No sign-up. You get Everyday Savings ·· 4821 with two weeks of made-up spending.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  actions: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: rt.insets.bottom + 22, gap: 16 },
  slip: { paddingTop: 8, paddingHorizontal: 18, paddingBottom: 6 },
  caption: {
    ...type.caption(11),
    paddingTop: 6,
    paddingBottom: 4,
    color: theme.colors.inkMuted,
  },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  promiseRule: { borderTopWidth: 2, borderStyle: 'dotted', borderColor: theme.colors.leader },
  index: { ...type.mono(11, 600), width: 20, letterSpacing: 0.88, color: theme.colors.inkMuted },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lemon: { backgroundColor: theme.colors.lemon },
  lilac: { backgroundColor: theme.colors.lilac },
  mint: { backgroundColor: theme.colors.mint },
  promiseText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  stamp: {
    ...type.caption(11),
    letterSpacing: 1.1,
    marginTop: 6,
    marginBottom: 4,
    paddingTop: 10,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.leader,
    color: theme.colors.stamp,
  },
  cta: { gap: 10 },
  small: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: theme.colors.inkMuted },
}));
