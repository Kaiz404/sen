import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HistoryScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>HISTORY</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.canvas,
  },
  title: {
    fontFamily: 'BricolageGrotesque96ptCondensed-ExtraBold',
    fontSize: 48,
    color: theme.colors.ink,
  },
}));
