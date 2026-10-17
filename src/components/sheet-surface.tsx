import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/**
 * The body of a native form sheet. iOS draws its own grabber. react-native-screens never reads
 * `sheetGrabberVisible` on Android, so Android gets a drawn Material 3 handle (32 x 4 dp in a 22 dp top area).
 */
export function SheetSurface({ children }: { readonly children?: ReactNode }): ReactNode {
  return (
    <View style={styles.sheet}>
      {Platform.OS === 'android' ? (
        <View
          testID="sheet-handle"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.handleArea}
        >
          <View style={styles.handle} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  sheet: {
    gap: 12,
    paddingTop: Platform.OS === 'android' ? 0 : 24,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 20,
    backgroundColor: theme.colors.canvas,
  },
  handleArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: theme.colors.inkMuted },
}));
