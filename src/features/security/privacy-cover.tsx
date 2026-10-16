import { type ReactNode, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { isAuthenticating, onAuthenticationEnd } from '@/features/auth';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

/**
 * iOS shows the app in the switcher after `inactive`, and also reports `inactive` while the Face ID sheet is up,
 * so `inactive` covers only when no prompt is running. A prompt that ends with the app still `inactive` (swiped
 * to the switcher) sends no new event, so the end of a prompt re-checks. `background` always covers. Android never emits
 * `inactive`, and FLAG_SECURE already blanks its recents preview, so it has no JS cover.
 */
export function coverShown(os: string, state: AppStateStatus, prompting: boolean): boolean {
  if (os !== 'ios') return false;
  return state === 'background' || (state === 'inactive' && !prompting);
}

function usePrivacyCoverShown(): boolean {
  const [shown, setShown] = useState(() =>
    coverShown(Platform.OS, AppState.currentState, isAuthenticating()),
  );
  useEffect(() => {
    const show = (state: AppStateStatus) =>
      setShown(coverShown(Platform.OS, state, isAuthenticating()));
    const sync = () => show(AppState.currentState);
    const appState = AppState.addEventListener('change', show);
    const stopPrompt = onAuthenticationEnd(sync);
    return () => {
      appState.remove();
      stopPrompt();
    };
  }, []);
  return shown;
}

/** Mounted last in the root layout, so it draws over every screen. */
export function PrivacyCover(): ReactNode {
  return usePrivacyCoverShown() ? <PrivacyCoverView /> : null;
}

export function PrivacyCoverView(): ReactNode {
  return (
    <View
      testID="privacy-cover"
      accessible
      accessibilityLabel="Sen. Content hidden while you switch apps."
      style={styles.cover}
    >
      <Text accessible={false} style={styles.wordmark}>
        Sen
      </Text>
      <Text accessible={false} style={styles.caption}>
        RESTING WHILE YOU SWITCH APPS
      </Text>
      <View style={styles.sen}>
        <Sen pose="asleep" size={250} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    overflow: 'hidden',
    paddingTop: rt.insets.top + 54,
    paddingLeft: 22,
    gap: 14,
    backgroundColor: theme.colors.lemon,
  },
  wordmark: { ...type.words(150), lineHeight: 120, color: theme.colors.onPastel },
  caption: {
    ...type.caption(11),
    letterSpacing: 1.54,
    color: theme.colors.onPastel,
    opacity: 0.75,
  },
  sen: { position: 'absolute', left: 30, bottom: -96 },
}));
