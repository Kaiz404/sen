import { type ReactNode, useState } from 'react';

import type { Biometric } from './prompt';
import type { PromptView } from './prompt-view';
import { type LockState, LockView } from './screens/lock-screen';
import { type PrimerState, PrimerView } from './screens/primer-screen';
import { WelcomeView } from './screens/welcome-screen';

const noop = () => {};
const BIOMETRIC: Biometric = 'faceId';

function Lock({ state }: { state: LockState }) {
  return (
    <LockView
      state={state}
      biometric={BIOMETRIC}
      amountsHidden
      onUnlock={noop}
      onOpenSettings={noop}
      onStartAgain={noop}
    />
  );
}

function Primer({ state }: { state: PrimerState }) {
  return (
    <PrimerView
      state={state}
      biometric={BIOMETRIC}
      amountsHidden
      onTurnOn={noop}
      onOpenSettings={noop}
      onBack={noop}
    />
  );
}

function Lockout() {
  const [state] = useState<PromptView>(() => ({ kind: 'lockout', until: Date.now() + 24_000 }));
  return <Lock state={state} />;
}

export const AUTH_STATES = {
  welcome: () => <WelcomeView onContinue={noop} />,
  'primer-ready': () => <Primer state={{ kind: 'idle' }} />,
  'primer-off': () => <Primer state={{ kind: 'off', canOpenSettings: true }} />,
  'lock-idle': () => <Lock state={{ kind: 'idle' }} />,
  'lock-checking': () => <Lock state={{ kind: 'checking' }} />,
  'lock-mismatch': () => <Lock state={{ kind: 'mismatch', triesLeft: 2 }} />,
  'lock-lockout': () => <Lockout />,
  'lock-off': () => <Lock state={{ kind: 'off', canOpenSettings: true }} />,
  'lock-unavailable': () => <Lock state={{ kind: 'off', canOpenSettings: false }} />,
  'lock-error': () => <Lock state={{ kind: 'error' }} />,
} satisfies Record<string, () => ReactNode>;
