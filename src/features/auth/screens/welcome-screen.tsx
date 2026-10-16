import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { type } from '@/theme/type';

import { Hero, type IconName, Key } from './parts';

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
  return (
    <View style={styles.screen}>
      <Hero
        title={['Meet', 'Sen.']}
        body="A coin that keeps its eyes shut on your money until you ask."
        sen={{ pose: 'happy', size: 170, label: 'Sen, waving hello' }}
      />
      <View style={styles.actions}>
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
                  <MaskedMark />
                ) : (
                  <MaterialCommunityIcons name={promise.icon} size={24} style={styles.tileIcon} />
                )}
              </View>
              <Text style={styles.promiseText}>{promise.text}</Text>
            </View>
          ))}
          <Text style={styles.stamp}>SIMULATED DATA · NO REAL ACCOUNT</Text>
        </View>
        <View style={styles.cta}>
          <Key
            testID="continue"
            icon="chevron-right"
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

/** "RM" over four coins, the masked amount mark. Always four, never the real digit count. */
function MaskedMark(): ReactNode {
  return (
    <View accessible accessibilityLabel="Amount hidden" style={styles.masked}>
      <Text style={styles.rm}>RM</Text>
      <View style={styles.coins}>
        {[0, 1, 2, 3].map((coin) => (
          <View key={coin} style={styles.coin} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  actions: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: rt.insets.bottom + 22, gap: 16 },
  slip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: theme.colors.paper,
  },
  caption: { ...type.caption(11), paddingVertical: 6, color: theme.colors.inkMuted },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  promiseRule: { borderTopWidth: 2, borderStyle: 'dotted', borderColor: theme.colors.rule },
  index: { ...type.mono(11, 600), width: 20, color: theme.colors.inkMuted },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lemon: { backgroundColor: theme.colors.lemon },
  lilac: { backgroundColor: theme.colors.lilac },
  mint: { backgroundColor: theme.colors.mint },
  tileIcon: { color: theme.colors.onPastel },
  promiseText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  stamp: {
    ...type.caption(11),
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.rule,
    color: theme.colors.stamp,
  },
  cta: { gap: 10 },
  small: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: theme.colors.inkMuted },
  masked: { alignItems: 'center', gap: 2 },
  rm: { ...type.numerals(11), color: theme.colors.onPastel },
  coins: { flexDirection: 'row', gap: 2 },
  coin: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.onPastel,
    backgroundColor: theme.colors.lemon,
  },
}));
