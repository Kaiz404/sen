import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { type LaunchTarget, type SenProps, UNLOCK_HOLD } from '@/features/sen';
import { useMotionPolicy } from '@/motion/policy';
import type { StoreCause } from '@/services/store-fault';

import {
  AMOUNTS_NOTE,
  BIOMETRIC,
  credentialName,
  RESET_COST,
  STORE_COPY,
  TIMED_OUT_TEXT,
} from '../copy';
import type { Session } from '../machine';
import type { Biometric } from '../prompt';
import { reportLaunchTarget } from '../launch';
import { afterRecheck, afterUnlock, canReset, initialView, type PromptView } from '../prompt-view';
import { signOut, unlock, useBiometric, useSessionStatus } from '../session';
import { openLockScreenSettings } from './device-settings';
import { Hero, Note, NoteCard, Notice, ProfileRow, TextLink } from './parts';
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

const ANSWERS: PromptAnswers = { ok: 'unlock' };

export type LockViewProps = {
  readonly state: LockState;
  /** The sensor to name on the key. Null when no strong biometric is enrolled, and the key just says "Unlock". */
  readonly biometric: Biometric | null;
  readonly onUnlock: () => void;
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
  const [seenLevel, setSeenLevel] = useState(support.level);
  if (seenLevel !== support.level) {
    setSeenLevel(support.level);
    setView((prev) => afterRecheck(prev, support.level));
  }
  // Holds "checking" until the answer lands, so the view never flashes idle in between.
  const [prompt, setPrompt] = useState<Prompt>(NOT_ASKED);
  const asking = prompt.kind === 'asking';
  usePromptMoments(LOCK_SEN, prompt, ANSWERS);

  const onUnlock = () => {
    if (asking) return;
    setPrompt({ kind: 'asking' });
    void unlock(UNLOCK_HOLD[level]).then((outcome) => {
      setPrompt({ kind: 'answered', outcome });
      if (!outcome.ok) setView(afterUnlock(view, outcome, Date.now()));
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
      biometric={support.level === 'strong' ? support.kind : null}
      onUnlock={onUnlock}
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
  onOpenLockSettings,
  onStartAgain,
  onReset,
  onLaunchTarget,
}: LockViewProps): ReactNode {
  const copy = biometric === null ? null : BIOMETRIC[biometric];
  const icon = copy?.icon ?? 'lock-outline';
  const signingOut = state.kind === 'signingOut';
  const unlocked = state.kind === 'unlocked';
  // The one auth key. Where no strong biometric is enrolled it just says "Unlock", and the phone asks for its screen lock.
  const unlockLabel = UNLOCK_LABEL[state.kind] ?? (copy === null ? 'Unlock' : `Unlock with ${copy.name}`);
  const retryLabel = copy === null ? 'Try again' : `Try ${copy.name} again`;
  const unlockKey = (label: string, keyIcon = icon, onPress = onUnlock) => (
    <Key
      testID="unlock"
      tone="lemon"
      size="xlarge"
      icon={keyIcon}
      label={label}
      disabled={state.kind === 'checking' || signingOut || unlocked}
      onPress={onPress}
    />
  );

  const body = (() => {
    switch (state.kind) {
      case 'idle':
      case 'checking':
      case 'signingOut':
      case 'unlocked':
        return (
          <>
            <ProfileRow />
            {unlockKey(unlockLabel)}
            <Note text={AMOUNTS_NOTE} />
          </>
        );
      case 'timedOut':
        return (
          <>
            <ProfileRow />
            <Notice text={TIMED_OUT_TEXT} />
            {unlockKey(retryLabel)}
          </>
        );
      case 'noLock':
        return (
          <>
            <ProfileRow />
            {unlockKey('Open lock-screen settings', 'cog', onOpenLockSettings)}
            <NoteCard
              icon="cellphone"
              text={`Sen never sees your face, fingerprint or ${credentialName()}. Your phone checks, and Sen only hears yes or no.`}
            />
          </>
        );
      case 'store':
        return (
          <>
            <ProfileRow />
            {canReset(state) && <Notice text={RESET_COST} />}
            {unlockKey('Try again')}
            {canReset(state) && (
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
          </>
        );
    }
  })();

  const hero =
    state.kind === 'store'
      ? storeHero(state.cause)
      : state.kind === 'noLock'
        ? noLockHero()
        : HERO[state.kind];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.fill} bounces={false}>
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
    </ScrollView>
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

const HERO: Readonly<Record<Exclude<LockState['kind'], 'store' | 'noLock'>, HeroCopy>> = {
  idle: IDLE_HERO,
  signingOut: IDLE_HERO,
  unlocked: { ...IDLE_HERO, sen: { pose: 'happy', label: "Sen, happy it's you" } },
  checking: {
    title: ['Welcome', 'back.'],
    body: 'Sen opens one eye while your phone checks.',
    sen: { pose: 'peek', label: 'Sen, peeking while your phone checks' },
  },
  timedOut: {
    title: ['Took', 'too long.'],
    body: 'Nothing was opened. Amounts are still hidden.',
    sen: { pose: 'shrug', label: 'Sen, shrugging because the check timed out' },
  },
  error: {
    title: ['Something', 'went wrong.'],
    body: 'Nothing was opened. Amounts are still hidden.',
    sen: { pose: 'worried', label: 'Sen, worried' },
  },
};

/** Android says "screen lock", iOS "passcode", so it reads the platform when it draws. */
function noLockHero(): HeroCopy {
  const lock = credentialName();
  return {
    title: ['Set a', `${lock}.`],
    body: `Set a ${lock} to use Sen. Your phone's lock is what keeps your money private.`,
    sen: { pose: 'shrug', label: 'Sen, shrugging because the phone has no screen lock' },
  };
}

function storeHero(cause: StoreCause): HeroCopy {
  const { title, body } = STORE_COPY[cause];
  return { title, body, sen: { pose: 'worried', label: 'Sen, worried it cannot open its store' } };
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  fill: { flexGrow: 1 },
  actions: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 18,
    gap: 14,
  },
}));
