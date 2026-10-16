import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { Sen } from '@/features/sen';
import { useSecondsLeft } from '@/motion/countdown';
import { type } from '@/theme/type';

import { useAmountsHidden } from '../amounts';
import { amountsNote, BIOMETRIC, type BiometricCopy, clock, triesLeftText } from '../copy';
import type { Session } from '../machine';
import type { Biometric } from '../prompt';
import { afterPrompt, initialView, type PromptView } from '../prompt-view';
import { signOut, unlock, useBiometric, useSessionStatus } from '../session';
import { openDeviceSettings } from './device-settings';
import { Brand, Hero, Note, NoteCard, Notice, ProfileRow, TextLink } from './parts';

export type LockState =
  PromptView | { readonly kind: 'checking' } | { readonly kind: 'signingOut' };

const FROM_SESSION: Partial<Record<Session['status'], LockState>> = {
  authenticating: { kind: 'checking' },
  signingOut: { kind: 'signingOut' },
};

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
  const status = useSessionStatus();
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
      state={FROM_SESSION[status] ?? view}
      biometric={support.kind}
      amountsHidden={amountsHidden}
      onUnlock={onUnlock}
      onOpenSettings={openDeviceSettings}
      onStartAgain={onStartAgain}
    />
  );
}

export function LockView({
  state,
  biometric,
  amountsHidden,
  onUnlock,
  onOpenSettings,
  onStartAgain,
}: LockViewProps): ReactNode {
  const copy = BIOMETRIC[biometric];
  const { name, icon } = copy;
  const secondsLeft = useSecondsLeft(state.kind === 'lockout' ? state.until : null);
  const shown: LockState = state.kind === 'lockout' && secondsLeft === 0 ? { kind: 'idle' } : state;
  if (shown.kind === 'lockout')
    return (
      <Lockout
        copy={copy}
        secondsLeft={secondsLeft}
        onUnlock={onUnlock}
        onStartAgain={onStartAgain}
      />
    );

  const signingOut = shown.kind === 'signingOut';
  const unlockKey = (label: string, keyIcon = icon, onPress = onUnlock) => (
    <Key
      testID="unlock"
      tone="lemon"
      size="xlarge"
      icon={keyIcon}
      label={label}
      disabled={shown.kind === 'checking' || signingOut}
      onPress={onPress}
    />
  );
  const passcode = (
    <Key
      tone="outline"
      size="medium"
      icon="lock-outline"
      label="Use device passcode"
      disabled={signingOut}
      onPress={onUnlock}
    />
  );

  const body = (() => {
    switch (shown.kind) {
      case 'idle':
      case 'checking':
      case 'signingOut':
        return (
          <>
            <ProfileRow />
            {unlockKey(shown.kind === 'checking' ? "Checking it's you" : `Unlock with ${name}`)}
            {passcode}
            <Note text={amountsNote(amountsHidden)} />
          </>
        );
      case 'mismatch':
        return (
          <>
            <ProfileRow />
            <Notice text={triesLeftText(shown.triesLeft, name)} />
            {unlockKey(`Try ${name} again`)}
            {passcode}
          </>
        );
      case 'off':
        return (
          <>
            <ProfileRow />
            {shown.canOpenSettings ? (
              <>
                {unlockKey('Open device settings', 'cog', onOpenSettings)}
                {passcode}
              </>
            ) : (
              unlockKey('Use device passcode', 'lock-outline')
            )}
            <NoteCard
              icon="cellphone"
              text="Either way, nothing leaves this phone. Sen never sees your face or passcode."
            />
          </>
        );
      case 'error':
        return (
          <>
            <ProfileRow />
            <Notice text="Sen couldn't check it's you. Try again." />
            {unlockKey('Try again')}
            {passcode}
          </>
        );
    }
  })();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Hero kind="lock" {...HERO[shown.kind](copy)} />
      <View style={styles.actions}>
        {body}
        <TextLink label="Not you? Start again" disabled={signingOut} onPress={onStartAgain} />
      </View>
    </View>
  );
}

type LockoutProps = {
  readonly copy: BiometricCopy;
  readonly secondsLeft: number;
  readonly onUnlock: () => void;
  readonly onStartAgain: () => void;
};

function Lockout({ copy, secondsLeft, onUnlock, onStartAgain }: LockoutProps): ReactNode {
  const { name, title, icon } = copy;
  return (
    <View style={styles.lockout}>
      <StatusBar style="light" />
      <Brand />
      <Text
        accessibilityRole="header"
        accessibilityLabel="Too many tries."
        style={styles.lockoutTitle}
      >
        {'Too many\n'}
        <Text style={styles.lockoutAccent}>tries.</Text>
      </Text>
      <Text style={styles.lockoutBody}>
        {`Your phone paused ${name}. Sen is napping until it's back. Wait, or use your device passcode now.`}
      </Text>
      <View
        accessible
        accessibilityLabel={`${title} available again in ${secondsLeft} seconds`}
        style={styles.cooldown}
      >
        <Text style={styles.cooldownCaption}>TRY {name.toUpperCase()} AGAIN IN</Text>
        <Text style={styles.clock}>{clock(secondsLeft)}</Text>
        <View style={styles.napping}>
          <Sen pose="asleep" size={150} />
        </View>
      </View>
      <View style={styles.lockoutKeys}>
        <Key
          testID="unlock"
          tone="lemon"
          size="xlarge"
          surface="hero"
          icon="lock-outline"
          label="Use device passcode"
          onPress={onUnlock}
        />
        <Key
          tone="outline"
          size="medium"
          surface="hero"
          icon={icon}
          label={`${title} back in ${clock(secondsLeft)}`}
          disabled
          onPress={onUnlock}
        />
        <TextLink onHero label="Not you? Start again" onPress={onStartAgain} />
      </View>
    </View>
  );
}

type HeroCopy = Pick<Parameters<typeof Hero>[0], 'title' | 'body' | 'sen'>;

const IDLE_HERO: HeroCopy = {
  title: ['Welcome', 'back.'],
  body: 'Sen kept its eyes shut while you were away.',
  sen: { pose: 'masked', label: 'Sen, eyes closed while Sen is locked' },
};

const HERO: Readonly<
  Record<Exclude<LockState['kind'], 'lockout'>, (copy: BiometricCopy) => HeroCopy>
> = {
  idle: () => IDLE_HERO,
  signingOut: () => IDLE_HERO,
  checking: () => ({
    title: ['Welcome', 'back.'],
    body: 'Sen opens one eye while your phone checks.',
    sen: { pose: 'peek', label: 'Sen, peeking while your phone checks' },
  }),
  mismatch: () => ({
    title: ['Not', 'quite.'],
    body: "That didn't look like you. Sen is still keeping amounts hidden.",
    sen: { pose: 'worried', label: "Sen, worried after it didn't match" },
  }),
  off: ({ title }) => ({
    title: [title, 'is off.'],
    body: "Turn it on in your phone's settings, or use your passcode.",
    sen: { pose: 'shrug', label: 'Sen, shrugging because it is not set up' },
  }),
  error: () => ({
    title: ['Something', 'went wrong.'],
    body: 'Nothing was opened. Amounts are still hidden.',
    sen: { pose: 'worried', label: 'Sen, worried' },
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
  lockout: {
    flex: 1,
    gap: 18,
    paddingTop: rt.insets.top + 26,
    paddingHorizontal: 22,
    paddingBottom: rt.insets.bottom + 18,
    backgroundColor: theme.colors.hero,
  },
  lockoutTitle: { ...type.words(80), lineHeight: 67, color: theme.colors.onHero },
  lockoutAccent: { color: theme.colors.heroAccent },
  lockoutBody: { fontSize: 16, lineHeight: 23, color: theme.colors.onHeroMuted },
  cooldown: {
    marginTop: 96,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: theme.colors.heroRaised,
  },
  cooldownCaption: { ...type.caption(11), color: theme.colors.onHeroMuted },
  clock: { ...type.numerals(88), lineHeight: 84, color: theme.colors.lemon },
  napping: { position: 'absolute', right: 6, top: -104 },
  lockoutKeys: { marginTop: 'auto', gap: 10 },
}));
