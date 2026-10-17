import { requireOptionalNativeModule } from 'expo';
import type { LocalAuthenticationResult } from 'expo-local-authentication';

type SenAuth = {
  confirmDeviceCredentialAsync(title: string): Promise<LocalAuthenticationResult>;
  cancelAsync(): Promise<void>;
};

const NOT_AVAILABLE: LocalAuthenticationResult = { success: false, error: 'not_available' };

/**
 * Asks Android for the phone's screen lock (PIN, pattern or password) with no biometrics in front of it
 * (`modules/sen-auth`, D40). The answer uses expo-local-authentication's codes. A build made before the module existed,
 * or any native throw, answers `not_available`, so the caller never waits on it.
 */
export async function confirmDeviceCredential(title: string): Promise<LocalAuthenticationResult> {
  const native = requireOptionalNativeModule<SenAuth>('SenAuth');
  if (native == null) return NOT_AVAILABLE;
  try {
    return await native.confirmDeviceCredentialAsync(title);
  } catch {
    return NOT_AVAILABLE;
  }
}

/** Dismisses the screen-lock prompt, which answers `user_cancel`. */
export async function cancelDeviceCredential(): Promise<void> {
  try {
    await requireOptionalNativeModule<SenAuth>('SenAuth')?.cancelAsync();
  } catch {
    // Nothing was open to cancel.
  }
}
