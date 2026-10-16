import { Linking, Platform } from 'react-native';

/** Android can open the security settings where biometrics live. iOS only allows Sen's own settings page. */
export function openDeviceSettings(): void {
  const opened =
    Platform.OS === 'android'
      ? Linking.sendIntent('android.settings.SECURITY_SETTINGS')
      : Linking.openSettings();
  opened.catch(() => Linking.openSettings().catch(() => undefined));
}
