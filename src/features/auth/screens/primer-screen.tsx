import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Sen } from '@/features/sen';
import { useSecondsLeft } from '@/motion/countdown';
import { type } from '@/theme/type';

import { useAmountsHidden } from '../amounts';
import { amountsNote, BIOMETRIC, type BiometricCopy, clock, triesLeftText } from '../copy';
import type { Biometric } from '../prompt';
import { afterPrompt, initialView, type PromptView } from '../prompt-view';
import { unlock, useBiometric, useIsAuthenticating } from '../session';
import { openDeviceSettings } from './device-settings';
import { type IconName, Key, Notice } from './parts';

export type PrimerState = PromptView | { readonly kind: 'checking' };

export type PrimerViewProps = {
  readonly state: PrimerState;
  readonly biometric: Biometric;
  readonly amountsHidden: boolean;
  readonly onTurnOn: () => void;
  readonly onOpenSettings: () => void;
  readonly onBack: () => void;
};

export function PrimerScreen(): ReactNode {
  const router = useRouter();
  const support = useBiometric();
  const checking = useIsAuthenticating();
  const amountsHidden = useAmountsHidden();
  const [view, setView] = useState(() => initialView(support.ready));

  const onTurnOn = () => {
    void unlock().then((outcome) => {
      if (!outcome.ok) setView((prev) => afterPrompt(prev, outcome.reason, Date.now()));
    });
  };

  return (
    <PrimerView
      state={checking ? { kind: 'checking' } : view}
      biometric={support.kind}
      amountsHidden={amountsHidden}
      onTurnOn={onTurnOn}
      onOpenSettings={openDeviceSettings}
      onBack={() => router.back()}
    />
  );
}

/** The first-run primer. It explains the prompt before the phone shows it. */
export function PrimerView({
  state,
  biometric,
  amountsHidden,
  onTurnOn,
  onOpenSettings,
  onBack,
}: PrimerViewProps): ReactNode {
  const copy = BIOMETRIC[biometric];
  const { name, icon } = copy;
  const secondsLeft = useSecondsLeft(state.kind === 'lockout' ? state.until : null);
  const shown: PrimerState =
    state.kind === 'lockout' && secondsLeft === 0 ? { kind: 'idle' } : state;
  const notice = noticeOf(shown, copy, secondsLeft);
  const settings = shown.kind === 'off' && shown.canOpenSettings;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.back}
        >
          <MaterialCommunityIcons name="arrow-left" size={21} style={styles.ink} />
        </Pressable>
        <Text style={styles.caption}>STEP 2 OF 2</Text>
      </View>
      <View style={styles.card}>
        <View accessible={false} style={styles.frame}>
          <MaterialCommunityIcons name={icon} size={64} style={styles.lemon} />
        </View>
        <View style={styles.sen}>
          <Sen pose="peek" size={180} label={`Sen, peeking one eye open at the ${name} frame`} />
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
          Your phone checks your face or fingerprint. Sen only hears yes or no.{' '}
          {amountsNote(amountsHidden)}
        </Text>
      </View>
      <View style={styles.points}>
        <Point
          icon="lock-outline"
          text={`If ${name} doesn't work, your device passcode always does.`}
        />
        <Point icon="cellphone" text="Nothing leaves this device. No account, no server." />
      </View>
      <View style={styles.keys}>
        {notice !== null && <Notice icon="alert-circle-outline" text={notice} />}
        {settings ? (
          <Key testID="turn-on" icon="cog" label="Open device settings" onPress={onOpenSettings} />
        ) : (
          <Key
            testID="turn-on"
            icon={icon}
            label={shown.kind === 'checking' ? "Checking it's you" : `Turn on ${name}`}
            disabled={shown.kind === 'checking' || shown.kind === 'lockout'}
            onPress={onTurnOn}
          />
        )}
        <Key tone="secondary" label="Use device passcode instead" onPress={onTurnOn} />
      </View>
    </View>
  );
}

function noticeOf(
  state: PrimerState,
  { name, title }: BiometricCopy,
  secondsLeft: number,
): string | null {
  switch (state.kind) {
    case 'idle':
    case 'checking':
      return null;
    case 'mismatch':
      return triesLeftText(state.triesLeft, name);
    case 'lockout':
      return `Too many tries. ${name} is back in ${clock(secondsLeft)}, or use your device passcode now.`;
    case 'off':
      return state.canOpenSettings
        ? `${title} is off. Turn it on in your phone's settings, or use your passcode.`
        : `This phone can't use ${name}. Your passcode works instead.`;
    case 'error':
      return "Sen couldn't check it's you. Try again.";
  }
}

function Point({ icon, text }: { readonly icon: IconName; readonly text: string }): ReactNode {
  return (
    <View style={styles.point}>
      <View accessible={false} style={styles.pointIcon}>
        <MaterialCommunityIcons name={icon} size={20} style={styles.ink} />
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
  back: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: theme.shape.keyBorder,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.paper,
  },
  ink: { color: theme.colors.ink },
  lemon: { color: theme.colors.lemon },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  card: {
    flex: 1,
    minHeight: 160,
    maxHeight: 236,
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: theme.colors.onPastel,
  },
  frame: {
    position: 'absolute',
    left: 30,
    top: 40,
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 7,
    borderColor: theme.colors.lemon,
  },
  sen: { position: 'absolute', right: -38, bottom: -68 },
  copy: { gap: 10 },
  title: { ...type.words(54), lineHeight: 47, color: theme.colors.ink },
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
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.paper,
  },
  pointText: { flex: 1, fontSize: 15, lineHeight: 20, color: theme.colors.ink },
  keys: { gap: 10 },
}));
