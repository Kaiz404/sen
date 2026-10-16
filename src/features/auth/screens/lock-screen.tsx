import { type ReactNode, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Sen } from '@/features/sen';
import { useSecondsLeft } from '@/motion/countdown';
import { type } from '@/theme/type';

import { useAmountsHidden } from '../amounts';
import { amountsNote, BIOMETRIC, type BiometricCopy, clock, triesLeftText } from '../copy';
import type { Biometric } from '../prompt';
import { afterPrompt, initialView, type PromptView } from '../prompt-view';
import { signOut, unlock, useBiometric, useIsAuthenticating } from '../session';
import { openDeviceSettings } from './device-settings';
import { Hero, Key, Note, Notice, ProfileRow, TextLink } from './parts';

export type LockState = PromptView | { readonly kind: 'checking' };

export type LockViewProps = {
  readonly state: LockState;
  readonly biometric: Biometric;
  readonly amountsHidden: boolean;
  readonly onUnlock: () => void;
  readonly onOpenSettings: () => void;
  readonly onStartAgain: () => void;
};

export function LockScreen(): ReactNode {
  const support = useBiometric();
  const checking = useIsAuthenticating();
  const amountsHidden = useAmountsHidden();
  const [view, setView] = useState(() => initialView(support.ready));

  const onUnlock = () => {
    void unlock().then((outcome) => {
      if (!outcome.ok) setView((prev) => afterPrompt(prev, outcome.reason, Date.now()));
    });
  };

  const onStartAgain = () =>
    Alert.alert('Start again?', 'This erases the demo data on this phone. Sen sets it up fresh.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start again',
        style: 'destructive',
        onPress: () => void signOut().catch(() => setView({ kind: 'error' })),
      },
    ]);

  return (
    <LockView
      state={checking ? { kind: 'checking' } : view}
      biometric={support.kind}
      amountsHidden={amountsHidden}
      onUnlock={onUnlock}
      onOpenSettings={openDeviceSettings}
      onStartAgain={onStartAgain}
    />
  );
}

/** Every Lock state from SF-LockStates, driven by props so the gallery can render each one. */
export function LockView({
  state,
  biometric,
  amountsHidden,
  onUnlock,
  onOpenSettings,
  onStartAgain,
}: LockViewProps): ReactNode {
  const copy = BIOMETRIC[biometric];
  const { name, title, icon } = copy;
  const secondsLeft = useSecondsLeft(state.kind === 'lockout' ? state.until : null);
  const shown: LockState = state.kind === 'lockout' && secondsLeft === 0 ? { kind: 'idle' } : state;
  const passcode = (
    <Key tone="secondary" icon="lock-outline" label="Use device passcode" onPress={onUnlock} />
  );

  const body = (() => {
    switch (shown.kind) {
      case 'idle':
      case 'checking':
        return (
          <>
            <ProfileRow />
            <Key
              testID="unlock"
              icon={icon}
              label={shown.kind === 'checking' ? "Checking it's you" : `Unlock with ${name}`}
              disabled={shown.kind === 'checking'}
              onPress={onUnlock}
            />
            {passcode}
            <Note text={amountsNote(amountsHidden)} />
          </>
        );
      case 'mismatch':
        return (
          <>
            <ProfileRow />
            <Notice icon="alert-circle-outline" text={triesLeftText(shown.triesLeft, name)} />
            <Key testID="unlock" icon={icon} label={`Try ${name} again`} onPress={onUnlock} />
            {passcode}
          </>
        );
      case 'lockout':
        return (
          <>
            <View
              accessible
              accessibilityLabel={`${title} available again in ${secondsLeft} seconds`}
              style={styles.cooldown}
            >
              <View style={styles.cooldownText}>
                <Text style={styles.caption}>TRY {name.toUpperCase()} AGAIN IN</Text>
                <Text style={styles.clock}>{clock(secondsLeft)}</Text>
              </View>
              <Sen pose="asleep" size={96} />
            </View>
            <Key
              testID="unlock"
              icon="lock-outline"
              label="Use device passcode"
              onPress={onUnlock}
            />
            <Key
              tone="secondary"
              icon={icon}
              label={`${title} back in ${clock(secondsLeft)}`}
              disabled
              onPress={onUnlock}
            />
          </>
        );
      case 'off':
        return (
          <>
            <ProfileRow />
            {shown.canOpenSettings ? (
              <>
                <Key
                  testID="unlock"
                  icon="cog"
                  label="Open device settings"
                  onPress={onOpenSettings}
                />
                {passcode}
              </>
            ) : (
              <Key
                testID="unlock"
                icon="lock-outline"
                label="Use device passcode"
                onPress={onUnlock}
              />
            )}
            <Note text="Either way, nothing leaves this phone. Sen never sees your face or passcode." />
          </>
        );
      case 'error':
        return (
          <>
            <ProfileRow />
            <Notice icon="alert-circle-outline" text="Sen couldn't check it's you. Try again." />
            <Key testID="unlock" icon={icon} label="Try again" onPress={onUnlock} />
            {passcode}
          </>
        );
    }
  })();

  return (
    <View style={styles.screen}>
      <Hero {...HERO[shown.kind](copy)} />
      <View style={styles.actions}>
        {body}
        <TextLink label="Not you? Start again" onPress={onStartAgain} />
      </View>
    </View>
  );
}

type HeroCopy = Pick<Parameters<typeof Hero>[0], 'title' | 'body' | 'sen'>;
const SEN_SIZE = 200;

const HERO: Readonly<Record<LockState['kind'], (copy: BiometricCopy) => HeroCopy>> = {
  idle: () => ({
    title: ['Welcome', 'back.'],
    body: 'Sen kept its eyes shut while you were away.',
    sen: { pose: 'masked', size: SEN_SIZE, label: 'Sen, eyes closed while Sen is locked' },
  }),
  checking: () => ({
    title: ['Welcome', 'back.'],
    body: 'Sen opens one eye while your phone checks.',
    sen: { pose: 'peek', size: SEN_SIZE, label: 'Sen, peeking while your phone checks' },
  }),
  mismatch: () => ({
    title: ['Not', 'quite.'],
    body: "That didn't look like you. Sen is still keeping amounts hidden.",
    sen: { pose: 'worried', size: SEN_SIZE, label: "Sen, worried after it didn't match" },
  }),
  lockout: ({ name }) => ({
    title: ['Too many', 'tries.'],
    body: `Your phone paused ${name}. Sen is napping until it's back. Wait, or use your device passcode now.`,
  }),
  off: ({ title }) => ({
    title: [title, 'is off.'],
    body: "Turn it on in your phone's settings, or use your passcode.",
    sen: { pose: 'shrug', size: SEN_SIZE, label: 'Sen, shrugging because it is not set up' },
  }),
  error: () => ({
    title: ['Something', 'went wrong.'],
    body: 'Nothing was opened. Amounts are still hidden.',
    sen: { pose: 'worried', size: SEN_SIZE, label: 'Sen, worried' },
  }),
};

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  actions: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 18,
    gap: 14,
  },
  cooldown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.stamp,
    backgroundColor: theme.colors.paper,
  },
  cooldownText: { gap: 6 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  clock: { ...type.numerals(48), color: theme.colors.ink },
}));
