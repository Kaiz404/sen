import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  NotificationFeedbackType,
  notificationAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from 'expo-haptics';
import { Platform } from 'react-native';

import { logEvent } from './logger';
import { readPref } from './prefs';

type IosHaptic =
  | { readonly kind: 'notification'; readonly type: NotificationFeedbackType }
  | { readonly kind: 'impact'; readonly style: ImpactFeedbackStyle }
  | { readonly kind: 'selection' };

const SUCCESS: IosHaptic = { kind: 'notification', type: NotificationFeedbackType.Success };
const ERROR: IosHaptic = { kind: 'notification', type: NotificationFeedbackType.Error };
const WARNING: IosHaptic = { kind: 'notification', type: NotificationFeedbackType.Warning };
const LIGHT: IosHaptic = { kind: 'impact', style: ImpactFeedbackStyle.Light };
const SELECTION: IosHaptic = { kind: 'selection' };

const HAPTICS = {
  unlock: { ios: SUCCESS, android: AndroidHaptics.Confirm },
  reveal: { ios: SUCCESS, android: AndroidHaptics.Confirm },
  saved: { ios: SUCCESS, android: AndroidHaptics.Confirm },
  authFailed: { ios: ERROR, android: AndroidHaptics.Reject },
  lockout: { ios: ERROR, android: AndroidHaptics.Reject },
  networkError: { ios: WARNING, android: AndroidHaptics.Reject },
  copy: { ios: LIGHT, android: AndroidHaptics.Context_Click },
  refreshLanded: { ios: LIGHT, android: AndroidHaptics.Clock_Tick },
  hideNow: { ios: LIGHT, android: AndroidHaptics.Toggle_Off },
  segment: { ios: SELECTION, android: AndroidHaptics.Segment_Tick },
  refreshThreshold: { ios: SELECTION, android: AndroidHaptics.Segment_Tick },
  themeToggle: { ios: SELECTION, android: AndroidHaptics.Segment_Tick },
} as const satisfies Record<string, { readonly ios: IosHaptic; readonly android: AndroidHaptics }>;

export type HapticEvent = keyof typeof HAPTICS;

function play(event: HapticEvent): Promise<void> {
  const row = HAPTICS[event];
  if (Platform.OS === 'android') return performAndroidHapticsAsync(row.android);
  const ios: IosHaptic = row.ios;
  switch (ios.kind) {
    case 'notification':
      return notificationAsync(ios.type);
    case 'impact':
      return impactAsync(ios.style);
    case 'selection':
      return selectionAsync();
  }
}

export function playHaptic(event: HapticEvent): void {
  if (!readPref('haptics')) return;
  play(event).catch(() => logEvent('haptics.failed'));
}
