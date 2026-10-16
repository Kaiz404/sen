import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { POSE_IDS, Sen } from '@/features/sen';
import { type } from '@/theme/type';

export const SEN_SIZES = [32, 72, 200] as const;

export function PoseIndex(): ReactNode {
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {POSE_IDS.map((pose) => (
        <View key={pose} style={styles.row}>
          <Text style={styles.name}>{pose}</Text>
          <View style={styles.sizes}>
            {SEN_SIZES.map((size) => (
              <Sen key={size} pose={pose} size={size} label={`Sen, ${pose}, ${size} pt`} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { padding: 20, gap: 28 },
  row: { gap: 10 },
  name: { ...type.caption(11), color: theme.colors.inkMuted },
  sizes: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
}));
