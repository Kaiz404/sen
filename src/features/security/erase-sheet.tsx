import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { SheetSurface } from '@/components/sheet-surface';
import { toast } from '@/components/toast';
import {
  type AuthFailure,
  BIOMETRIC,
  type BiometricCopy,
  openDeviceSettings,
  useBiometric,
  useDb,
  useStepUp,
} from '@/features/auth';
import { Sen } from '@/features/sen';
import { type } from '@/theme/type';

import { eraseAdded } from './erase';
import { useAddedCount } from './use-added-count';

export type ErasePhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'erasing' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> };

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const REFUSED: Readonly<Record<Exclude<AuthFailure, 'cancelled'>, (name: string) => string>> = {
  timedOut: () => 'The check timed out. Nothing was erased. Try again when you’re ready.',
  mismatch: (name) => `${capital(name)} didn’t match. Nothing was erased.`,
  lockout: () => 'Too many tries. Nothing was erased. Use your device passcode next time.',
  not_set_up: (name) =>
    `${capital(name)} is off. Nothing was erased. Turn it on in your phone’s security settings, then try again.`,
  unavailable: (name) =>
    `${capital(name)} isn’t available right now. Nothing was erased. Check your phone’s security settings, then try again.`,
  unknown: () =>
    'Something went wrong with the check. Nothing was erased. Check your phone’s security settings, then try again.',
};

/** A retry can't fix these until the phone's own settings change. */
const NEEDS_SETTINGS: ReadonlySet<string> = new Set(['not_set_up', 'unavailable', 'unknown']);

const rows = (n: number) => `${n} ${n === 1 ? 'transaction' : 'transactions'}`;

export function EraseView({
  sensor,
  phase,
  count,
  onErase,
  onCancel,
  onOpenSettings,
}: {
  readonly sensor: BiometricCopy;
  readonly phase: ErasePhase;
  /** How many added rows there are, or null while that loads. */
  readonly count: number | null;
  readonly onErase: () => void;
  readonly onCancel: () => void;
  readonly onOpenSettings: () => void;
}): ReactNode {
  const busy = phase.kind === 'checking' || phase.kind === 'erasing';
  const needsSettings = phase.kind === 'refused' && NEEDS_SETTINGS.has(phase.reason);
  const label =
    phase.kind === 'checking'
      ? 'Checking it’s you…'
      : phase.kind === 'erasing'
        ? 'Erasing…'
        : phase.kind === 'refused' || phase.kind === 'failed'
          ? `Try again with ${sensor.name}`
          : `Erase with ${sensor.name}`;

  if (count === 0 && phase.kind === 'ready')
    return (
      <SheetSurface>
        <Sen pose="look" size={56} label="Sen, looking" />
        <Text accessibilityRole="header" style={styles.title}>
          Nothing to erase
        </Text>
        <Text style={styles.body}>
          You haven’t added any transactions on this phone. Your bank transactions can’t be erased.
        </Text>
        <Key tone="outline" size="large" label="Close" onPress={onCancel} />
      </SheetSurface>
    );

  return (
    <SheetSurface>
      <Sen pose="worried" size={56} label="Sen, worried" />
      <Text accessibilityRole="header" style={styles.title}>
        Erase transactions I added?
      </Text>
      <Text style={styles.body}>
        {`Sen deletes ${count === null ? 'the transactions' : `the ${rows(count)}`} you added on this phone. This can’t be undone. Your bank transactions, your settings and the security log stay. It asks for ${sensor.name} first.`}
      </Text>
      {phase.kind === 'refused' && (
        <Text accessibilityRole="alert" style={styles.problem}>
          {REFUSED[phase.reason](sensor.name)}
        </Text>
      )}
      {phase.kind === 'failed' && (
        <Text accessibilityRole="alert" style={styles.problem}>
          Couldn’t erase them. Nothing was changed.
        </Text>
      )}
      {needsSettings && (
        <Key
          tone="lemon"
          size="xlarge"
          icon="cog"
          label="Open device settings"
          onPress={onOpenSettings}
        />
      )}
      <Key
        tone={needsSettings ? 'outline' : 'loud'}
        size={needsSettings ? 'large' : 'xlarge'}
        icon="delete-forever-outline"
        label={label}
        disabled={busy}
        onPress={onErase}
      />
      <Key
        tone="outline"
        size="large"
        label="Cancel"
        disabled={phase.kind === 'erasing'}
        onPress={onCancel}
      />
    </SheetSurface>
  );
}

export function EraseSheet(): ReactNode {
  const router = useRouter();
  const db = useDb();
  const sensor = BIOMETRIC[useBiometric().kind];
  const confirm = useStepUp('erase');
  const added = useAddedCount();
  const [phase, setPhase] = useState<ErasePhase>({ kind: 'ready' });
  // The sheet keeps the number it was asked about while it closes, instead of flipping to "Nothing to erase".
  const [erased, setErased] = useState<number | null>(null);

  const onErase = async () => {
    if (phase.kind === 'checking' || phase.kind === 'erasing') return;
    setPhase({ kind: 'checking' });
    const outcome = await eraseAdded(db, async () => {
      const auth = await confirm();
      if (auth.ok) setPhase({ kind: 'erasing' });
      return auth;
    });
    switch (outcome.kind) {
      case 'erased':
        setErased(outcome.count);
        toast.show({
          title: `Erased ${rows(outcome.count)}`,
          detail: 'Your bank transactions are as they were.',
        });
        router.back();
        return;
      case 'empty':
      case 'cancelled':
        setPhase({ kind: 'ready' });
        return;
      case 'refused':
        setPhase({ kind: 'refused', reason: outcome.reason });
        return;
      case 'failed':
        setPhase({ kind: 'failed' });
        return;
    }
  };

  return (
    <EraseView
      sensor={sensor}
      phase={phase}
      count={erased ?? added}
      onErase={() => void onErase()}
      onCancel={() => router.back()}
      onOpenSettings={openDeviceSettings}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  title: { ...type.words(30), color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted },
  problem: { fontSize: 14, fontWeight: '600', color: theme.colors.danger },
}));
