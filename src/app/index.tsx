import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function LockScreen() {
  const [failed, setFailed] = useState(false);

  const unlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Sen',
      biometricsSecurityLevel: 'strong',
      disableDeviceFallback: false,
    });
    if (result.success) router.replace('/history');
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

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: theme.colors.canvas,
  },
  title: {
    fontFamily: 'BricolageGrotesque96ptCondensed-ExtraBold',
    fontSize: 72,
    color: theme.colors.ink,
  },
  hint: { fontFamily: 'IBMPlexMono', fontWeight: '500', color: theme.colors.inkMuted },
  key: {
    minHeight: 56,
    paddingHorizontal: 32,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.lemon,
  },
  keyLabel: {
    fontFamily: 'BricolageGrotesque96ptCondensed-ExtraBold',
    fontSize: 22,
    color: theme.colors.ink,
  },
}));
