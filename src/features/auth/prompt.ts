import {
  AuthenticationType,
  authenticateAsync,
  getEnrolledLevelAsync,
  type LocalAuthenticationError,
  SecurityLevel,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';
import { Platform } from 'react-native';

export type AuthFailure =
  'cancelled' | 'mismatch' | 'lockout' | 'not_set_up' | 'unavailable' | 'unknown';
export type AuthOutcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure };

/**
 * `user_fallback` only fires when the passcode button is hidden. Sen always allows the device fallback, so the
 * code is treated as a cancel rather than a reason to prompt again.
 */
const FAILURE: Readonly<Record<LocalAuthenticationError, AuthFailure>> = {
  user_cancel: 'cancelled',
  system_cancel: 'cancelled',
  app_cancel: 'cancelled',
  user_fallback: 'cancelled',
  authentication_failed: 'mismatch',
  lockout: 'lockout',
  not_enrolled: 'not_set_up',
  passcode_not_set: 'not_set_up',
  not_available: 'unavailable',
  no_space: 'unknown',
  timeout: 'unknown',
  unable_to_process: 'unknown',
  invalid_context: 'unknown',
  unknown: 'unknown',
};

/** Set before the prompt opens and cleared in `finally`. AppState reads it so the prompt's own focus loss never locks. */
export const isAuthenticatingRef = { current: false };

const BUSY: AuthOutcome = { ok: false, reason: 'cancelled' };

export async function authenticate(promptMessage: string): Promise<AuthOutcome> {
  if (isAuthenticatingRef.current) return BUSY;
  isAuthenticatingRef.current = true;
  try {
    const result = await authenticateAsync({
      promptMessage,
      biometricsSecurityLevel: 'strong',
      disableDeviceFallback: false,
    });
    return result.success ? { ok: true } : { ok: false, reason: FAILURE[result.error] };
  } catch {
    return { ok: false, reason: 'unknown' };
  } finally {
    isAuthenticatingRef.current = false;
  }
}

export type Biometric = 'faceId' | 'touchId' | 'face' | 'fingerprint';

export function biometricOf(
  os: typeof Platform.OS,
  types: readonly AuthenticationType[],
): Biometric {
  const face = types.includes(AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(AuthenticationType.FINGERPRINT);
  if (os === 'ios') return finger && !face ? 'touchId' : 'faceId';
  return face && !finger ? 'face' : 'fingerprint';
}

/** `ready` means a strong biometric is enrolled. Without one the prompt goes straight to the passcode. */
export type BiometricSupport = { readonly kind: Biometric; readonly ready: boolean };

export async function detectBiometric(): Promise<BiometricSupport> {
  const [types, level] = await Promise.all([
    supportedAuthenticationTypesAsync().catch(() => []),
    getEnrolledLevelAsync().catch(() => SecurityLevel.NONE),
  ]);
  return { kind: biometricOf(Platform.OS, types), ready: level >= SecurityLevel.BIOMETRIC_STRONG };
}
