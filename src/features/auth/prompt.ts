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

import { cancelDeviceCredential, confirmDeviceCredential } from '@/services/device-credential';

export type AuthFailure =
  | 'cancelled'
  /** The prompt sat unanswered for `PROMPT_TIMEOUT_MS` of foreground time. Not a failed try. */
  | 'timedOut'
  | 'mismatch'
  | 'lockout'
  | 'not_set_up'
  /** The phone has no screen lock at all, so there is nothing to check against (D28). */
  | 'noLock'
  | 'unavailable'
  | 'unknown';
export type AuthOutcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure };

/** What one native ask answers. `fallback` is the user tapping the sheet's own screen-lock button (iOS "Use passcode"). */
type Answer = { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure | 'fallback' };

const FAILURE: Readonly<Record<LocalAuthenticationError, AuthFailure | 'fallback'>> = {
  user_cancel: 'cancelled',
  system_cancel: 'cancelled',
  app_cancel: 'cancelled',
  user_fallback: 'fallback',
  authentication_failed: 'mismatch',
  lockout: 'lockout',
  not_enrolled: 'not_set_up',
  passcode_not_set: 'noLock',
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
function failureOf(error: string): AuthFailure | 'fallback' {
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

/**
 * Which check a prompt asks for (D40). `biometric` is the sensor alone, with a Cancel button and no screen lock behind
 * it. `credential` is the phone's screen lock alone: PIN, pattern or password on Android, and the passcode on iOS.
 */
export type AuthVia = 'biometric' | 'credential';

/** The strong, biometrics-only options. `strong` must never sit beside a device fallback: Android 9 and 10 refuse that pair. */
export const BIOMETRIC_OPTIONS = {
  biometricsSecurityLevel: 'strong',
  disableDeviceFallback: true,
  cancelLabel: 'Cancel',
  // iOS shows this button after a miss. Android has no such button, and expo maps its Cancel to `user_cancel`.
  fallbackLabel: 'Use passcode',
} as const;

/** A screen lock is never locked out by biometric misses and has no mismatch, so those overrides map to the nearest honest answer. */
const CREDENTIAL_OVERRIDE: Readonly<Record<keyof typeof AUTH_OVERRIDES, LocalAuthenticationResult>> = {
  pass: AUTH_OVERRIDES.pass,
  fail: AUTH_OVERRIDES.cancel,
  cancel: AUTH_OVERRIDES.cancel,
  lockout: AUTH_OVERRIDES.pass,
};

function nativePrompt(promptMessage: string, via: AuthVia): Promise<LocalAuthenticationResult> {
  if (__DEV__ && authOverride !== 'real')
    return Promise.resolve(
      (via === 'credential' ? CREDENTIAL_OVERRIDE : AUTH_OVERRIDES)[authOverride],
    );
  if (via === 'biometric') return authenticateAsync({ promptMessage, ...BIOMETRIC_OPTIONS });
  // iOS has no passcode-only policy: this is the system sheet with Face ID or Touch ID first, then the passcode.
  if (Platform.OS === 'ios') return authenticateAsync({ promptMessage, disableDeviceFallback: false });
  return confirmDeviceCredential(promptMessage);
}

function cancelNative(via: AuthVia): void {
  if (via === 'credential' && Platform.OS === 'android') void cancelDeviceCredential();
  else cancelAuthenticate().catch(() => undefined);
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

/** A prompt asked for while another is up. No check happened, so it reads as a cancel. */
const BUSY: AuthOutcome = { ok: false, reason: 'cancelled' };

/**
 * A prompt the OS never answers, such as one the app was backgrounded under, would leave Lock on "Checking it's
 * you" with every key disabled. After this long in the foreground the prompt is cancelled and ends as `timedOut`,
 * which screens explain, where a user cancel is silent. Time away from `active` does not count. iOS cannot cancel
 * its sheet, and the Face ID and passcode sheets make the app `inactive`, so an answer entered late must still land.
 */
export const PROMPT_TIMEOUT_MS = 60_000;

/**
 * The screen-lock prompt waits longer. Android 11 and later draw it over Sen, so the app stays `active` while a
 * pattern is drawn, and after five wrong tries the phone itself makes the user wait 30 s. Android 9 and 10 open the
 * system's own screen, which takes the app out of `active`, so the clock stops there as it does for any other
 * absence (inferred, not seen on a device).
 */
export const CREDENTIAL_TIMEOUT_MS = 5 * 60_000;

const TIMEOUT_MS: Readonly<Record<AuthVia, number>> = {
  biometric: PROMPT_TIMEOUT_MS,
  credential: CREDENTIAL_TIMEOUT_MS,
};

const TIMED_OUT = Symbol('timed out');

let guard: { pause(): void; resume(): void } | null = null;

/** The app left `active` or came back to it. The pending prompt's clock stops, and starts again from zero. */
export function promptAppState(state: AppStateStatus): void {
  if (state === 'active') guard?.resume();
  else guard?.pause();
}

/**
 * Asks the phone once, by the sensor or by the screen lock. When the user taps the sheet's own screen-lock button
 * (iOS), the screen lock follows in the same call, so no screen has to route it.
 */
export async function authenticate(
  promptMessage: string,
  via: AuthVia = 'biometric',
): Promise<AuthOutcome> {
  const answer = await askOnce(promptMessage, via);
  if (answer.ok) return answer;
  if (answer.reason !== 'fallback') return { ok: false, reason: answer.reason };
  return via === 'biometric' ? authenticate(promptMessage, 'credential') : BUSY;
}

async function askOnce(promptMessage: string, via: AuthVia): Promise<Answer> {
  if (isAuthenticatingRef.current) return BUSY;
  isAuthenticatingRef.current = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      const resume = () => {
        clearTimeout(timer);
        timer = setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS[via]);
      };
      guard = { pause: () => clearTimeout(timer), resume };
      resume();
    });
    const result = await Promise.race([nativePrompt(promptMessage, via), timeout]);
    if (result === TIMED_OUT) {
      cancelNative(via);
      return { ok: false, reason: 'timedOut' };
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

/** `biometrics` is the name when the phone has no single sensor to name, which is also the fallback. */
export type Biometric = 'faceId' | 'touchId' | 'face' | 'fingerprint' | 'biometrics';

/**
 * Android reports which sensors the phone has, not which one is enrolled, so a phone with both or neither is
 * "biometrics" and only a phone with one sensor names it.
 */
export function biometricOf(
  os: typeof Platform.OS,
  types: readonly AuthenticationType[],
): Biometric {
  const face = types.includes(AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(AuthenticationType.FINGERPRINT);
  if (os === 'ios') return finger && !face ? 'touchId' : 'faceId';
  if (face === finger) return 'biometrics';
  return face ? 'face' : 'fingerprint';
}

/** What the phone has enrolled. `weak` is a Class 2 biometric, such as many phones' face unlock, which Sen cannot accept. */
export type EnrolledLevel = 'none' | 'passcode' | 'weak' | 'strong';

export type BiometricSupport = { readonly kind: Biometric; readonly level: EnrolledLevel };

function levelOf(level: SecurityLevel): EnrolledLevel {
  if (level >= SecurityLevel.BIOMETRIC_STRONG) return 'strong';
  if (level >= SecurityLevel.BIOMETRIC_WEAK) return 'weak';
  return level === SecurityLevel.NONE ? 'none' : 'passcode';
}

/**
 * A throw from the level read says nothing about the phone, so it keeps the level from the last good read. With
 * no earlier read it is `passcode`, which still lets the unlock key try, where `none` would strand the user on
 * "Set a screen lock".
 */
export async function detectBiometric(previous?: BiometricSupport): Promise<BiometricSupport> {
  const [types, level] = await Promise.all([
    supportedAuthenticationTypesAsync().catch(() => []),
    getEnrolledLevelAsync().then(levelOf, () => previous?.level ?? 'passcode'),
  ]);
  return { kind: biometricOf(Platform.OS, types), level };
}
