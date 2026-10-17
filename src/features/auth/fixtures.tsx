import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import type { Biometric } from './prompt';
import { type LockState, LockView } from './screens/lock-screen';
import { type PrimerState, PrimerView } from './screens/primer-screen';
import { WelcomeView } from './screens/welcome-screen';

const noop = () => {};
/** Gallery shots name the phone's own sensor: Face ID has no business on an Android screenshot. */
const BIOMETRIC: Biometric = Platform.OS === 'ios' ? 'faceId' : 'fingerprint';

/** `biometric` is null on a phone with no strong biometric enrolled, where the one key just says "Unlock". */
function Lock({ state, biometric = BIOMETRIC }: { state: LockState; biometric?: Biometric | null }) {
  return (
    <LockView
      state={state}
      biometric={biometric}
      onUnlock={noop}
      onOpenLockSettings={noop}
      onStartAgain={noop}
      onReset={noop}
    />
  );
}

function Primer({ state }: { state: PrimerState }) {
  return (
    <PrimerView
      state={state}
      biometric={BIOMETRIC}
      onTurnOn={noop}
      onOpenLockSettings={noop}
      onBack={noop}
    />
  );
}

export const AUTH_STATES = {
  welcome: () => <WelcomeView onContinue={noop} onOpenLockSettings={noop} />,
  'welcome-no-lock': () => <WelcomeView noLock onContinue={noop} onOpenLockSettings={noop} />,
  'primer-ready': () => <Primer state={{ kind: 'idle' }} />,
  'primer-timed-out': () => <Primer state={{ kind: 'timedOut' }} />,
  'lock-idle': () => <Lock state={{ kind: 'idle' }} />,
  // A phone with a fingerprint and a face sensor: Android cannot say which is enrolled, so Sen says "biometrics".
  'lock-biometrics': () => <Lock state={{ kind: 'idle' }} biometric="biometrics" />,
  // No strong biometric enrolled: the same single key, and the phone asks for its screen lock.
  'lock-screen-lock': () => <Lock state={{ kind: 'idle' }} biometric={null} />,
  'lock-checking': () => <Lock state={{ kind: 'checking' }} />,
  'lock-timed-out': () => <Lock state={{ kind: 'timedOut' }} />,
  'lock-no-lock': () => <Lock state={{ kind: 'noLock' }} />,
  'lock-error': () => <Lock state={{ kind: 'error' }} />,
  'lock-store': () => (
    <Lock state={{ kind: 'store', cause: 'store', failures: 1, firstAt: 0, lastAt: 0 }} />
  ),
  'lock-store-reset': () => (
    <Lock state={{ kind: 'store', cause: 'store', failures: 2, firstAt: 0, lastAt: 0 }} />
  ),
  'lock-full': () => (
    <Lock state={{ kind: 'store', cause: 'full', failures: 2, firstAt: 0, lastAt: 0 }} />
  ),
} satisfies Record<string, () => ReactNode>;
