import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

type ErrorViewProps = {
  readonly onRetry: () => void;
  readonly onHome: () => void;
};

/**
 * A screen threw while rendering. Sen is the static one, because this view can stand where the layout's providers
 * and Sen's director are gone. The root boundary replaces the root layout, so the gesture root the keys need is
 * rendered here.
 */
export function ErrorView({ onRetry, onHome }: ErrorViewProps): ReactNode {
  return (
    <GestureHandlerRootView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.sen}>
        <Sen pose="worried" size={190} label="Sen, worried something went wrong on this screen" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Something went wrong.
      </Text>
      <Text style={styles.body}>
        Sen hit a snag on this screen. Amounts are still hidden. Try again, or go back to History.
      </Text>
      <View style={styles.keys}>
        <Key
          testID="retry"
          tone="lemon"
          size="xlarge"
          surface="hero"
          icon="refresh"
          label="Try again"
          onPress={onRetry}
        />
        <Key
          tone="outline"
          size="medium"
          surface="hero"
          icon="history"
          label="Back to History"
          onPress={onHome}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: 14,
    paddingTop: rt.insets.top + 26,
    paddingHorizontal: 22,
    paddingBottom: rt.insets.bottom + 18,
    backgroundColor: theme.colors.hero,
  },
  sen: { alignItems: 'center', marginTop: 40 },
  title: { ...type.words(54), lineHeight: 50, color: theme.colors.onHero },
  body: { fontSize: 16, lineHeight: 23, color: theme.colors.onHeroMuted },
  keys: { marginTop: 'auto', gap: 10 },
}));
