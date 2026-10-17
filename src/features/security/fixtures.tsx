import { BIOMETRIC } from '@/features/auth';

import { EraseView, type ErasePhase } from './erase-sheet';
import { PrivacyCoverView } from './privacy-cover';

const noop = () => {};

const erase = (phase: ErasePhase, count: number | null = 3) =>
  function EraseState() {
    return (
      <EraseView
        sensor={BIOMETRIC.fingerprint}
        phase={phase}
        count={count}
        onErase={noop}
        onCancel={noop}
        onOpenSettings={noop}
      />
    );
  };

export const SECURITY_STATES = {
  'privacy-cover': () => <PrivacyCoverView />,
  erase: erase({ kind: 'ready' }),
  'erase-checking': erase({ kind: 'checking' }),
  'erase-refused': erase({ kind: 'refused', reason: 'mismatch' }),
  'erase-needs-settings': erase({ kind: 'refused', reason: 'not_set_up' }),
  'erase-failed': erase({ kind: 'failed' }),
  'erase-erasing': erase({ kind: 'erasing' }),
  'erase-empty': erase({ kind: 'ready' }, 0),
};
