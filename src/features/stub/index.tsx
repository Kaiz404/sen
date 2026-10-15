import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { type } from '@/theme/type';

export { DbSmoke } from './db-smoke';

/**
 * Phase 1 placeholder screen. It shows the route's name, so a deep-link screenshot proves which route
 * opened. Seeded feature indexes render it until their lane replaces them. Phase 6 deletes this folder.
 */
export function StubScreen({ name, detail }: { name: string; detail?: string }): ReactNode {
  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{name}</Text>
      {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: theme.colors.canvas,
  },
  name: { ...type.words(48), color: theme.colors.ink },
  detail: { ...type.mono(13), color: theme.colors.inkMuted, textAlign: 'center' },
}));
