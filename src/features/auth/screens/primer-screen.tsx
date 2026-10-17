import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type IconName, Key } from '@/components/key';
import { Sen, UNLOCK_HOLD } from '@/features/sen';
import { useMotionPolicy } from '@/motion/policy';
import { type } from '@/theme/type';

import { AMOUNTS_NOTE, BIOMETRIC, credentialName, STORE_COPY, TIMED_OUT_TEXT } from '../copy';
import type { Biometric } from '../prompt';
import { afterRecheck, afterUnlock, initialView, type PromptView } from '../prompt-view';
import { unlock, useBiometric, useSessionStatus } from '../session';
import { openLockScreenSettings } from './device-settings';
import { Notice } from './parts';
import { NOT_ASKED, type Prompt, type PromptAnswers, usePromptMoments } from './prompt-moments';

export type PrimerState =
  PromptView | { readonly kind: 'checking' } | { readonly kind: 'unlocked' };

const PRIMER_SEN = 'primer';

const ANSWERS: PromptAnswers = { ok: 'unlock' };

export type PrimerViewProps = {
  readonly state: PrimerState;
  /** The sensor to name. Null when no strong biometric is enrolled. */
  readonly biometric: Biometric | null;
  readonly onTurnOn: () => void;
  readonly onOpenLockSettings: () => void;
  readonly onBack: () => void;
};

export function PrimerScreen(): ReactNode {
  const router = useRouter();
  const support = useBiometric();
  const status = useSessionStatus();
  const level = useMotionPolicy();
  const [view, setView] = useState(() => initialView(support.level));
  const [seenLevel, setSeenLevel] = useState(support.level);
  if (seenLevel !== support.level) {
    setSeenLevel(support.level);
    setView((prev) => afterRecheck(prev, support.level));
  }
  const [prompt, setPrompt] = useState<Prompt>(NOT_ASKED);
  const asking = prompt.kind === 'asking';
  usePromptMoments(PRIMER_SEN, prompt, ANSWERS);

  const onTurnOn = () => {
    if (asking) return;
    setPrompt({ kind: 'asking' });
    void unlock(UNLOCK_HOLD[level]).then((outcome) => {
      setPrompt({ kind: 'answered', outcome });
      if (!outcome.ok) setView((prev) => afterUnlock(prev, outcome, Date.now()));
    });
  };

  const state: PrimerState =
    status === 'arriving'
      ? { kind: 'unlocked' }
      : status === 'authenticating' || asking
        ? { kind: 'checking' }
        : view;

  return (
    <PrimerView
      state={state}
      biometric={support.level === 'strong' ? support.kind : null}
      onTurnOn={onTurnOn}
      onOpenLockSettings={openLockScreenSettings}
      onBack={() => router.back()}
    />
  );
}

export function PrimerView({
  state,
  biometric,
  onTurnOn,
  onOpenLockSettings,
  onBack,
}: PrimerViewProps): ReactNode {
  const { theme, rt } = useUnistyles();
  const copy = biometric === null ? null : BIOMETRIC[biometric];
  const icon = copy?.icon ?? 'lock-outline';
  const notice = noticeOf(state);
  const noLock = state.kind === 'noLock';
  const unlocked = state.kind === 'unlocked';

  return (
    <View style={styles.screen}>
      <StatusBar style={rt.themeName === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Key icon="arrow-left" accessibilityLabel="Back" onPress={onBack} />
        <Text style={styles.caption}>STEP 2 OF 2</Text>
      </View>
      <View style={styles.card}>
        <View accessible={false} style={styles.frame}>
          <Svg width={FRAME} height={FRAME} style={styles.corners}>
            <Path
              d={CORNERS}
              fill="none"
              stroke={theme.colors.lemon}
              strokeWidth={7}
              strokeLinecap="round"
            />
          </Svg>
          <MaterialCommunityIcons name={icon} size={64} color={theme.colors.lemon} />
        </View>
        <View style={styles.sen}>
          <Sen
            id={PRIMER_SEN}
            pose={unlocked ? 'happy' : 'peek'}
            size={210}
            label={
              unlocked
                ? 'Sen, happy it can check it is you'
                : 'Sen, peeking one eye open at the frame'
            }
          />
        </View>
      </View>
      <View style={styles.copy}>
        <Text
          accessibilityRole="header"
          accessibilityLabel="Let Sen check it's you."
          style={styles.title}
        >
          {"Let Sen check\nit's you."}
        </Text>
        <Text style={styles.body}>
          Your phone checks it&apos;s you. Sen only hears yes or no. {AMOUNTS_NOTE}
        </Text>
      </View>
      <View style={styles.points}>
        <Point
          icon="lock-outline"
          text={`Your phone's ${credentialName()} always works too.`}
        />
        <Point icon="cellphone" text="Nothing leaves this device. No account, no server." />
      </View>
      <View style={styles.keys}>
        {notice !== null && <Notice text={notice} />}
        {noLock ? (
          <Key
            testID="turn-on"
            tone="lemon"
            size="xlarge"
            icon="cog"
            label="Open lock-screen settings"
            onPress={onOpenLockSettings}
          />
        ) : (
          <Key
            testID="turn-on"
            tone="lemon"
            size="xlarge"
            icon={icon}
            label={
              state.kind === 'checking'
                ? "Checking it's you"
                : unlocked
                  ? 'Unlocked'
                  : copy === null
                    ? 'Continue'
                    : `Turn on ${copy.name}`
            }
            disabled={state.kind === 'checking' || unlocked}
            onPress={onTurnOn}
          />
        )}
      </View>
    </View>
  );
}

function noticeOf(state: PrimerState): string | null {
  switch (state.kind) {
    case 'idle':
    case 'checking':
    case 'unlocked':
      return null;
    case 'timedOut':
      return TIMED_OUT_TEXT;
    case 'noLock':
      return `Set a ${credentialName()} to use Sen.`;
    case 'error':
      return "Sen couldn't check it's you. Try again.";
    case 'store':
      return STORE_COPY[state.cause].body;
  }
}

const FRAME = 132;
const CORNERS =
  'M4 38V20Q4 4 20 4H38M94 4H112Q128 4 128 20V38M128 94V112Q128 128 112 128H94M38 128H20Q4 128 4 112V94';

function Point({ icon, text }: { readonly icon: IconName; readonly text: string }): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View style={styles.point}>
      <View accessible={false} style={styles.pointIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.colors.ink} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: 18,
    paddingTop: rt.insets.top + 18,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 24,
    backgroundColor: theme.colors.canvas,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  card: {
    flex: 1,
    minHeight: 160,
    maxHeight: 236,
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: theme.colors.hero,
  },
  frame: {
    position: 'absolute',
    left: 30,
    top: 40,
    width: FRAME,
    height: FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corners: { position: 'absolute' },
  sen: { position: 'absolute', right: -44, bottom: -78 },
  copy: { gap: 10 },
  title: { ...type.words(54), lineHeight: 46, color: theme.colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: theme.colors.ink },
  points: { gap: 10 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.leader,
    backgroundColor: theme.colors.paper,
  },
  pointText: { flex: 1, fontSize: 15, lineHeight: 20, color: theme.colors.ink },
  keys: { gap: 10 },
}));
