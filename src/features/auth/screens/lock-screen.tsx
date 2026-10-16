import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { type LaunchTarget, Sen, type SenProps, UNLOCK_HOLD } from '@/features/sen';
import type { StoreCause } from '@/services/store-fault';
import { useSecondsLeft } from '@/motion/countdown';
import { useMotionPolicy } from '@/motion/policy';
import { type } from '@/theme/type';

import {
  AMOUNTS_NOTE,
  BIOMETRIC,
  type BiometricCopy,
  clock,
  RESET_COST,
  STORE_COPY,
  triesLeftText,
} from '../copy';
import type { Session } from '../machine';
import type { Biometric } from '../prompt';
import { afterRecheck, afterUnlock, canReset, initialView, type PromptView } from '../prompt-view';
import { reportLaunchTarget } from '../launch';
import { signOut, unlock, useBiometric, useSessionStatus } from '../session';
import { openDeviceSettings, openLockScreenSettings } from './device-settings';
import { Brand, Hero, Note, NoteCard, Notice, ProfileRow, TextLink } from './parts';
import { NOT_ASKED, type Prompt, type PromptAnswers, usePromptMoments } from './prompt-moments';

export type LockState =
  | PromptView
  | { readonly kind: 'checking' }
  | { readonly kind: 'signingOut' }
  | { readonly kind: 'unlocked' };

const CHECKING: LockState = { kind: 'checking' };

const FROM_SESSION: Partial<Record<Session['status'], LockState>> = {
  authenticating: CHECKING,
  arriving: { kind: 'unlocked' },
  signingOut: { kind: 'signingOut' },
};

/** Lock's Sen, the hero's and the napping one, which never show together. */
const LOCK_SEN = 'lock';

const ANSWERS: PromptAnswers = { ok: 'unlock', mismatch: 'authFailed', lockout: 'lockout' };

export type LockViewProps = {
  readonly state: LockState;
  readonly biometric: Biometric;
  readonly onUnlock: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenLockSettings: () => void;
  readonly onStartAgain: () => void;
  readonly onReset: () => void;
  /** The cold-start launch hands off into this screen's Sen. */
  readonly onLaunchTarget?: (target: LaunchTarget) => void;
};

export function LockScreen(): ReactNode {
  const support = useBiometric();
  const status = useSessionStatus();
  const level = useMotionPolicy();
  const [view, setView] = useState(() => initialView(support.level));
  useEffect(() => setView((prev) => afterRecheck(prev, support.level)), [support.level]);
  // Holds "checking" until the answer lands, so the view never flashes idle in between.
  const [prompt, setPrompt] = useState<Prompt>(NOT_ASKED);
  const asking = prompt.kind === 'asking';
  usePromptMoments(LOCK_SEN, prompt, ANSWERS);

  const onUnlock = () => {
    if (asking) return;
    setPrompt({ kind: 'asking' });
    void unlock(UNLOCK_HOLD[level]).then((outcome) => {
      const now = Date.now();
      const next = outcome.ok ? view : afterUnlock(view, outcome, now);
      const napping = next.kind === 'lockout' && next.until > now;
      setPrompt({ kind: 'answered', outcome, ...(napping && { rest: 'lockoutBreathe' }) });
      setView(next);
    });
  };

  const eraseWithConfirm = (title: string, message: string, action: string) => () =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: () => void signOut().catch(() => setView({ kind: 'error' })),
      },
    ]);
  const onStartAgain = eraseWithConfirm(
    'Start again?',
    'This erases the demo data on this phone. Sen sets it up fresh.',
    'Start again',
  );
  const onReset = eraseWithConfirm(
    'Reset Sen on this phone?',
    `${RESET_COST} Sen sets itself up fresh.`,
    'Reset Sen',
  );

  return (
    <LockView
      state={FROM_SESSION[status] ?? (asking ? CHECKING : view)}
      biometric={support.kind}
      onUnlock={onUnlock}
      onOpenSettings={openDeviceSettings}
      onOpenLockSettings={openLockScreenSettings}
      onStartAgain={onStartAgain}
      onReset={onReset}
      onLaunchTarget={reportLaunchTarget}
    />
  );
}

export function LockView({
  state,
  biometric,
  onUnlock,
  onOpenSettings,
  onOpenLockSettings,
  onStartAgain,
  onReset,
  onLaunchTarget,
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
  const unlocked = shown.kind === 'unlocked';
  const unlockKey = (label: string, keyIcon = icon, onPress = onUnlock) => (
    <Key
      testID="unlock"
      tone="lemon"
      size="xlarge"
      icon={keyIcon}
      label={label}
      disabled={shown.kind === 'checking' || signingOut || unlocked}
      onPress={onPress}
    />
  );
  const passcode = (
    <Key
      tone="outline"
      size="medium"
      icon="lock-outline"
      label="Use device passcode"
      disabled={signingOut || unlocked}
      onPress={onUnlock}
    />
  );

  const body = (() => {
    switch (shown.kind) {
      case 'idle':
      case 'checking':
      case 'signingOut':
      case 'unlocked':
        return (
          <>
            <ProfileRow />
            {unlockKey(UNLOCK_LABEL[shown.kind] ?? `Unlock with ${name}`)}
            {passcode}
            <Note text={AMOUNTS_NOTE} />
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
      case 'noLock':
        return (
          <>
            <ProfileRow />
            {unlockKey('Open lock-screen settings', 'cog', onOpenLockSettings)}
            <NoteCard
              icon="cellphone"
              text="Sen never sees your face, fingerprint or passcode. Your phone checks, and Sen only hears yes or no."
            />
          </>
        );
      case 'store':
        return (
          <>
            <ProfileRow />
            {canReset(shown) && <Notice text={RESET_COST} />}
            {unlockKey('Try again')}
            {canReset(shown) && (
              <Key
                tone="outline"
                size="medium"
                icon="restore"
                label="Reset Sen on this phone"
                onPress={onReset}
              />
            )}
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

  const hero = shown.kind === 'store' ? storeHero(shown.cause) : HERO[shown.kind](copy);
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Hero
        kind="lock"
        {...hero}
        sen={{ ...hero.sen, id: LOCK_SEN }}
        onLaunchTarget={onLaunchTarget}
      />
      <View style={styles.actions}>
        {body}
        <TextLink
          label="Not you? Start again"
          disabled={signingOut || unlocked}
          onPress={onStartAgain}
        />
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
          <Sen id={LOCK_SEN} pose="asleep" size={150} />
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

type HeroCopy = Pick<Parameters<typeof Hero>[0], 'title' | 'body'> & {
  readonly sen: Omit<SenProps, 'size' | 'id'>;
};

const UNLOCK_LABEL: Partial<Record<LockState['kind'], string>> = {
  checking: "Checking it's you",
  unlocked: 'Unlocked',
};

const IDLE_HERO: HeroCopy = {
  title: ['Welcome', 'back.'],
  body: 'Sen kept its eyes shut while you were away.',
  sen: { pose: 'masked', label: 'Sen, eyes closed while Sen is locked' },
};

const HERO: Readonly<
  Record<Exclude<LockState['kind'], 'lockout' | 'store'>, (copy: BiometricCopy) => HeroCopy>
> = {
  idle: () => IDLE_HERO,
  signingOut: () => IDLE_HERO,
  unlocked: () => ({
    ...IDLE_HERO,
    sen: { pose: 'happy', label: "Sen, happy it's you" },
  }),
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
  noLock: () => ({
    title: ['Set a', 'screen lock.'],
    body: "Set a screen lock to use Sen. Your phone's lock is what keeps your money private.",
    sen: { pose: 'shrug', label: 'Sen, shrugging because the phone has no screen lock' },
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

function storeHero(cause: StoreCause): HeroCopy {
  const { title, body } = STORE_COPY[cause];
  return { title, body, sen: { pose: 'worried', label: 'Sen, worried it cannot open its store' } };
}

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
