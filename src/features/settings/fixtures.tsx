import type { ReactNode } from 'react';

import { PREFS } from '@/models/prefs';

import { PrivacyView, ResetDemoView, SignOutView } from './sheets';
import {
  type SettingsActions,
  type SettingsValues,
  SettingsView,
  type SettingsViewProps,
} from './settings-screen';

const noop = () => {};

const NO_ACTIONS: SettingsActions = {
  onPref: noop,
  onHideAmounts: noop,
  onDataset: noop,
  onLockout: noop,
  onResetDemo: noop,
  onPrivacy: noop,
  onLockNow: noop,
  onSignOut: noop,
  onBack: noop,
};

const DEFAULTS: SettingsValues = {
  biometric: 'fingerprint',
  lockoutArmed: false,
  progress: null,
  hideAmounts: true,
  theme: PREFS.theme.default,
  idleLock: PREFS.idleLock.default,
  relockAfter: PREFS.relockAfter.default,
  senMotion: PREFS.senMotion.default,
  haptics: PREFS.haptics.default,
  'demo.next': PREFS['demo.next'].default,
  'demo.datasetSize': PREFS['demo.datasetSize'].default,
  'demo.slow': PREFS['demo.slow'].default,
  'demo.newOnRefresh': PREFS['demo.newOnRefresh'].default,
};

const BASE: SettingsViewProps = { values: DEFAULTS, actions: NO_ACTIONS, focus: 'top' };

export const SETTINGS_STATES = {
  top: () => <SettingsView {...BASE} />,
  reviewers: () => <SettingsView {...BASE} focus="reviewers" />,
  'reviewers-armed': () => (
    <SettingsView
      {...BASE}
      focus="reviewers"
      values={{ ...DEFAULTS, 'demo.next': 'offline', 'demo.slow': true, lockoutArmed: true }}
    />
  ),
  'reviewers-loading': () => (
    <SettingsView
      {...BASE}
      focus="reviewers"
      values={{
        ...DEFAULTS,
        'demo.datasetSize': 10000,
        progress: { received: 1500, total: 10000 },
      }}
    />
  ),
  calm: () => (
    <SettingsView {...BASE} values={{ ...DEFAULTS, senMotion: 'calm', hideAmounts: false }} />
  ),
  privacy: () => <PrivacyView biometric="fingerprint" onClose={noop} />,
  'sign-out': () => <SignOutView onSignOut={noop} onCancel={noop} />,
  'reset-demo': () => <ResetDemoView phase="ready" onReset={noop} onCancel={noop} />,
  'reset-demo-failed': () => <ResetDemoView phase="failed" onReset={noop} onCancel={noop} />,
} satisfies Readonly<Record<string, () => ReactNode>>;
