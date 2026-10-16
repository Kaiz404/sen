import { BIOMETRIC } from '@/features/auth';

import { EraseView } from './erase-sheet';
import { PrivacyCoverView } from './privacy-cover';

const noop = () => {};

export const SECURITY_STATES = {
  'privacy-cover': () => <PrivacyCoverView />,
  erase: () => (
    <EraseView
      sensor={BIOMETRIC.fingerprint}
      phase={{ kind: 'ready' }}
      onErase={noop}
      onCancel={noop}
    />
  ),
  'erase-checking': () => (
    <EraseView
      sensor={BIOMETRIC.fingerprint}
      phase={{ kind: 'checking' }}
      onErase={noop}
      onCancel={noop}
    />
  ),
  'erase-refused': () => (
    <EraseView
      sensor={BIOMETRIC.fingerprint}
      phase={{ kind: 'refused', reason: 'mismatch' }}
      onErase={noop}
      onCancel={noop}
    />
  ),
  'erase-erasing': () => (
    <EraseView
      sensor={BIOMETRIC.fingerprint}
      phase={{ kind: 'erasing' }}
      onErase={noop}
      onCancel={noop}
    />
  ),
};
