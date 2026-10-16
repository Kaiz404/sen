import { Linking, Platform } from 'react-native';

/** Android can open the security settings where biometrics live. iOS only allows Sen's own settings page. */
/** The screen where a screen lock is chosen. Android has an action for it, and iOS only opens Sen's settings page. */
export function openLockScreenSettings(): void {
  const opened =
    Platform.OS === 'android'
      ? Linking.sendIntent('android.app.action.SET_NEW_PASSWORD')
      : Linking.openSettings();
  opened.catch(() => openDeviceSettings());
}

export function openDeviceSettings(): void {
  const opened =
    Platform.OS === 'android'
      ? Linking.sendIntent('android.settings.SECURITY_SETTINGS')
      : Linking.openSettings();
  opened.catch(() => Linking.openSettings().catch(() => undefined));
}
