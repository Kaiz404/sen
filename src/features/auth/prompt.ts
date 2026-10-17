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
  /** The prompt sat unanswered for its clock of foreground time. Not a failed try. */
  | 'timedOut'
  /** The phone has no screen lock at all, so there is nothing to check against (D28). */
  | 'noLock'
  | 'unavailable'
  | 'unknown';
export type AuthOutcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure };

/** What one native ask answers. `lockout` is the sensor refusing for a while, which `authenticate` hands over from. */
export type Answer = { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure | 'lockout' };

const FAILURE: Readonly<Record<LocalAuthenticationError, AuthFailure | 'lockout'>> = {
  user_cancel: 'cancelled',
  system_cancel: 'cancelled',
  app_cancel: 'cancelled',
  user_fallback: 'cancelled',
  // The system sheet owns misses: Android never reports one, and iOS's passcode policy retries inside its sheet.
  authentication_failed: 'unknown',
  lockout: 'lockout',
  not_enrolled: 'unavailable',
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
function failureOf(error: string): AuthFailure | 'lockout' {
  return Object.hasOwn(FAILURE, error) ? FAILURE[error as LocalAuthenticationError] : 'unknown';
}

/** What the native prompt answers while a device flow drives the app, since no agent can press a real finger. */
const AUTH_OVERRIDES = {
  pass: { success: true },
  cancel: { success: false, error: 'user_cancel' },
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
 * What one native ask is (D40).
 * - `combined`: the sensor, with the screen lock inside the same system sheet. `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`
 *   on Android, `deviceOwnerAuthentication` on iOS. The OS owns the misses and moves to the screen lock after five.
 * - `sensor`: the strong sensor alone, with a Cancel button.
 * - `credential`: the screen lock alone, PIN, pattern or password on Android.
 */
type Ask = 'combined' | 'sensor' | 'credential';

/**
 * Which asks Sen makes on this phone.
 * - `combined`: one ask.
 * - `sensorThenCredential`: the sensor, then the screen lock when the sensor is locked out or unavailable.
 * - `credential`: one ask, because no strong biometric is enrolled.
 */
export type Route = 'combined' | 'sensorThenCredential' | 'credential';

/**
 * `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` is unsupported on Android 9 and 10 (API 28 and 29), and
 * `PromptInfo.Builder.build()` throws there. Read from androidx.biometric 1.2.0-alpha04, which expo-local-authentication
 * 57.0.3 builds against: `AuthenticatorUtils.isSupportedCombination(BIOMETRIC_STRONG | DEVICE_CREDENTIAL)` is
 * `SDK_INT < 28 || SDK_INT > 29`. So API 24 to 27 take the combined sheet as API 30 and later do.
 */
const supportsCombined = (api: number): boolean => api < 28 || api > 29;

export function routeOf(os: typeof Platform.OS, api: number, level: EnrolledLevel): Route {
  if (os === 'ios') return 'combined';
  if (level !== 'strong') return 'credential';
  return supportsCombined(api) ? 'combined' : 'sensorThenCredential';
}

/** The pair that must never reach Android 9 or 10. `routeOf` is the only way to it. */
const COMBINED_OPTIONS = { biometricsSecurityLevel: 'strong', disableDeviceFallback: false } as const;

/** The strong sensor alone. */
export const SENSOR_OPTIONS = {
  biometricsSecurityLevel: 'strong',
  disableDeviceFallback: true,
  cancelLabel: 'Cancel',
} as const;

function nativePrompt(promptMessage: string, ask: Ask): Promise<LocalAuthenticationResult> {
  if (__DEV__ && authOverride !== 'real') return Promise.resolve(AUTH_OVERRIDES[authOverride]);
  if (ask === 'sensor') return authenticateAsync({ promptMessage, ...SENSOR_OPTIONS });
  if (ask === 'credential' && Platform.OS === 'android') return confirmDeviceCredential(promptMessage);
  return authenticateAsync({ promptMessage, ...COMBINED_OPTIONS });
}

function cancelNative(ask: Ask): void {
  if (ask === 'credential' && Platform.OS === 'android') void cancelDeviceCredential();
  else cancelAuthenticate().catch(() => undefined);
}

const isAuthenticatingRef = { current: false };

/** True while the system biometric sheet is up, which iOS reports to the app as `inactive`. */
export const isAuthenticating = (): boolean => isAuthenticatingRef.current;

const endListeners = new Set<(answer: Answer) => void>();

/**
 * Calls `listener` each time a prompt ends, once `isAuthenticating` is false again, with how it ended. A hand-over
 * from the sensor to the screen lock is two prompts, so it calls twice. Returns the unsubscribe.
 */
export function onAuthenticationEnd(listener: (answer: Answer) => void): () => void {
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
 * This is the sensor-alone clock.
 */
export const PROMPT_TIMEOUT_MS = 60_000;

/**
 * Any sheet that can end in the screen lock waits longer, because the user may switch to a slow pattern or password
 * inside it, and after five wrong tries the phone itself makes them wait 30 s. Android 11 and later draw these over
 * Sen, so the app stays `active` and the clock would run. Android 9 and 10 open the system's own screen for the
 * screen lock, which takes the app out of `active`, so the clock pauses there as for any absence (inferred, not
 * seen on a device).
 */
export const CREDENTIAL_TIMEOUT_MS = 5 * 60_000;

const TIMEOUT_MS: Readonly<Record<Ask, number>> = {
  sensor: PROMPT_TIMEOUT_MS,
  combined: CREDENTIAL_TIMEOUT_MS,
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
 * The one way Sen checks it is you, for unlock and for every step-up (D40). It picks the route from the phone and
 * what is enrolled, so no screen chooses between the sensor and the screen lock. Where the sensor was locked out, or
 * the sensor alone was asked and is unavailable, the screen lock follows in the same call. `beforeHandOver` hears why
 * first, and a false answer ends the check as a cancel with no second prompt (a lock arrived meanwhile).
 */
export async function authenticate(
  promptMessage: string,
  level: EnrolledLevel,
  beforeHandOver?: (why: 'lockout' | 'unavailable') => boolean,
): Promise<AuthOutcome> {
  const route = routeOf(Platform.OS, Number(Platform.Version), level);
  const first: Ask =
    route === 'credential' ? 'credential' : route === 'combined' ? 'combined' : 'sensor';
  const answer = await askOnce(promptMessage, first);
  if (answer.ok) return answer;
  const handOver =
    first !== 'credential' &&
    (answer.reason === 'lockout' || (first === 'sensor' && answer.reason === 'unavailable'));
  if (!handOver) return { ok: false, reason: answer.reason === 'lockout' ? 'unknown' : answer.reason };
  if (beforeHandOver?.(answer.reason === 'lockout' ? 'lockout' : 'unavailable') === false) return BUSY;
  const second = await askOnce(promptMessage, 'credential');
  return second.ok ? second : { ok: false, reason: second.reason === 'lockout' ? 'unknown' : second.reason };
}

async function askOnce(promptMessage: string, ask: Ask): Promise<Answer> {
  if (isAuthenticatingRef.current) return BUSY;
  isAuthenticatingRef.current = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let answer: Answer = { ok: false, reason: 'unknown' };
  try {
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      const resume = () => {
        clearTimeout(timer);
        timer = setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS[ask]);
      };
      guard = { pause: () => clearTimeout(timer), resume };
      resume();
    });
    const result = await Promise.race([nativePrompt(promptMessage, ask), timeout]);
    if (result === TIMED_OUT) {
      cancelNative(ask);
      answer = { ok: false, reason: 'timedOut' };
    } else {
      answer = result.success ? { ok: true } : { ok: false, reason: failureOf(result.error) };
    }
    return answer;
  } catch {
    return answer;
  } finally {
    clearTimeout(timer);
    guard = null;
    isAuthenticatingRef.current = false;
    endListeners.forEach((listener) => listener(answer));
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
