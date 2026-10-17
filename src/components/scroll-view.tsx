import { ScrollView as NativeScrollView } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';

/**
 * React Native's ScrollView, with a `contentContainerStyle` that follows the theme and the insets. Unistyles updates
 * only `style` on a plain ScrollView, so content padding built on `rt.insets` would keep its bundle-start value
 * (ARCHITECTURE › Layout and insets).
 */
export const ScrollView = withUnistyles(NativeScrollView);
