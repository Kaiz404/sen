import {
  AuthenticationType,
  authenticateAsync,
  cancelAuthenticate,
  getEnrolledLevelAsync,
  type LocalAuthenticationError,
  type LocalAuthenticationResult,
  SecurityLevel,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';
import { type AppStateStatus, Platform } from 'react-native';

export type AuthFailure =
  'cancelled' | 'mismatch' | 'lockout' | 'not_set_up' | 'unavailable' | 'unknown';
export type AuthOutcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure };

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

/**
 * The native module can return codes outside its typed union (iOS sends `unknown: <code>, <message>` and
 * `missing_usage_description`), so the code is untrusted input and anything not in the table is `unknown`.
 */
function failureOf(error: string): AuthFailure {
  return Object.hasOwn(FAILURE, error) ? FAILURE[error as LocalAuthenticationError] : 'unknown';
}

/** What the native prompt answers while a device flow drives the app, since no agent can press a real finger. */
const AUTH_OVERRIDES = {
  pass: { success: true },
  fail: { success: false, error: 'authentication_failed' },
  cancel: { success: false, error: 'user_cancel' },
  lockout: { success: false, error: 'lockout' },
} as const satisfies Readonly<Record<string, LocalAuthenticationResult>>;

export type AuthOverride = keyof typeof AUTH_OVERRIDES | 'real';

let authOverride: AuthOverride = 'real';

export function isAuthOverride(value: string): value is AuthOverride {
  return value === 'real' || Object.hasOwn(AUTH_OVERRIDES, value);
}

/** Dev builds only. Release builds compile `__DEV__` to false, so the override is never stored or read. */
export function setAuthOverride(next: AuthOverride): void {
  if (__DEV__) authOverride = next;
}

function nativePrompt(promptMessage: string): Promise<LocalAuthenticationResult> {
  if (__DEV__ && authOverride !== 'real') return Promise.resolve(AUTH_OVERRIDES[authOverride]);
  return authenticateAsync({
    promptMessage,
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
}

const isAuthenticatingRef = { current: false };

/** True while the system biometric sheet is up, which iOS reports to the app as `inactive`. */
export const isAuthenticating = (): boolean => isAuthenticatingRef.current;

const endListeners = new Set<() => void>();

/** Calls `listener` each time a prompt ends, once `isAuthenticating` is false again. Returns the unsubscribe. */
export function onAuthenticationEnd(listener: () => void): () => void {
  endListeners.add(listener);
  return () => void endListeners.delete(listener);
}

/** Also what a prompt that timed out returns, since both mean no check happened. */
const BUSY: AuthOutcome = { ok: false, reason: 'cancelled' };

/**
 * A prompt the OS never answers, such as one the app was backgrounded under, would leave Lock on "Checking it's
 * you" with every key disabled. After this long in the foreground the prompt is cancelled and counts as a cancel.
 * Time spent in the background does not count, since a passcode screen can take a while.
 */
export const PROMPT_TIMEOUT_MS = 60_000;

const TIMED_OUT = Symbol('timed out');

let guard: { pause(): void; resume(): void } | null = null;

/** The app moved to `background` or came back to `active`. The pending prompt's clock follows. */
export function promptAppState(state: AppStateStatus): void {
  if (state === 'background') guard?.pause();
  else if (state === 'active') guard?.resume();
}

export async function authenticate(promptMessage: string): Promise<AuthOutcome> {
  if (isAuthenticatingRef.current) return BUSY;
  isAuthenticatingRef.current = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      const resume = () => {
        clearTimeout(timer);
        timer = setTimeout(() => resolve(TIMED_OUT), PROMPT_TIMEOUT_MS);
      };
      guard = { pause: () => clearTimeout(timer), resume };
      resume();
    });
    const result = await Promise.race([nativePrompt(promptMessage), timeout]);
    if (result === TIMED_OUT) {
      cancelAuthenticate().catch(() => undefined);
      return BUSY;
    }
    return result.success ? { ok: true } : { ok: false, reason: failureOf(result.error) };
  } catch {
    return { ok: false, reason: 'unknown' };
  } finally {
    clearTimeout(timer);
    guard = null;
    isAuthenticatingRef.current = false;
    endListeners.forEach((listener) => listener());
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

/** What the phone has enrolled. `weak` is a Class 2 biometric, such as many phones' face unlock, which Sen cannot accept. */
export type EnrolledLevel = 'none' | 'passcode' | 'weak' | 'strong';

export type BiometricSupport = { readonly kind: Biometric; readonly level: EnrolledLevel };

function levelOf(level: SecurityLevel): EnrolledLevel {
  if (level >= SecurityLevel.BIOMETRIC_STRONG) return 'strong';
  if (level >= SecurityLevel.BIOMETRIC_WEAK) return 'weak';
  return level === SecurityLevel.NONE ? 'none' : 'passcode';
}

export async function detectBiometric(): Promise<BiometricSupport> {
  const [types, level] = await Promise.all([
    supportedAuthenticationTypesAsync().catch(() => []),
    getEnrolledLevelAsync().catch(() => SecurityLevel.NONE),
  ]);
  return { kind: biometricOf(Platform.OS, types), level: levelOf(level) };
}
