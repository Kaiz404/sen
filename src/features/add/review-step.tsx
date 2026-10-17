import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { Key } from '@/components/key';
import { Leader, ReceiptSlip, SlipRule } from '@/components/receipt-slip';
import { Tag } from '@/components/tag';
import { toast } from '@/components/toast';
import {
  type AuthFailure,
  type Biometric,
  useBiometric,
  useDb,
  useStepUp,
} from '@/features/auth';
import { Sen } from '@/features/sen';
import { CATEGORY_LABEL } from '@/models/category';
import { type DayKey, toInstant } from '@/models/day';
import { isInAddWindow } from '@/models/draft';
import { minor, moneyText, signed, signedMinor } from '@/models/money';
import { capital } from '@/models/text';
import type { TxId } from '@/models/transaction';
import type { Db } from '@/services/db';
import { playHaptic } from '@/services/haptics';
import { DEMO_ACCOUNT } from '@/services/seed';
import { manualReference } from '@/services/tx-repo';
import { type } from '@/theme/type';

import { saveDraft, undoAdd } from './actions';
import { todayInMalaysia, useDraft } from './add-layout';
import { BIOMETRIC_ICON, BIOMETRIC_NAME, CATEGORY_ICON, dayText } from './copy';
import { cleanDescription, type DraftInput, toDraft } from './draft';
import { DiscardDialog, Notice, ScreenshotsBlocked, StepHeader } from './parts';
import { useCloseGuard } from './use-close-guard';

/** Where the review stands. A save that lands leaves the screen, so it has no state here. */
export type SaveState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'refused'; readonly reason: AuthFailure }
  | { readonly kind: 'failed' };

const REFUSED: Readonly<Record<AuthFailure, (name: string) => string>> = {
  cancelled: (name) => `${capital(name)} was cancelled. Save again when you're ready.`,
  timedOut: () => "The check timed out. Save again when you're ready.",
  mismatch: (name) => `${capital(name)} didn't match. Save again when you're ready.`,
  lockout: () => 'Too many tries. Use your device passcode when you save again.',
  not_set_up: (name) => `${capital(name)} is off. Your device passcode still works.`,
  unavailable: (name) => `${capital(name)} isn't available right now. Try again soon.`,
  unknown: () => 'Something went wrong with the check. Save again when you are ready.',
};

export type ReviewViewProps = {
  readonly draft: DraftInput;
  readonly today: DayKey;
  readonly biometric: Biometric;
  readonly state: SaveState;
  readonly discarding: boolean;
  readonly onSave: () => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
};

export function ReviewView({
  draft,
  today,
  biometric,
  state,
  discarding,
  onSave,
  onBack,
  onClose,
  onDiscard,
  onKeep,
}: ReviewViewProps): ReactNode {
  const ready = toDraft(draft, today) !== null;
  const biometricName = BIOMETRIC_NAME[biometric];
  const saveLabel =
    state.kind === 'checking'
      ? 'Checking it’s you…'
      : state.kind === 'failed'
        ? `Retry with ${biometricName}`
        : `Save with ${biometricName}`;
  return (
    <View style={styles.screen}>
      <View style={styles.pad}>
        <StepHeader step={3} onBack={onBack} onClose={onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!ready && !isInAddWindow(draft.day, today) && (
          <Notice
            tone="danger"
            icon="alert-circle-outline"
            title="Can't save this date"
            body={
              draft.day > today
                ? 'That date is now in the future. Pick another.'
                : 'That date is now more than 90 days ago. Pick another.'
            }
          />
        )}
        {state.kind === 'refused' && (
          <Notice
            tone="calm"
            icon="information-outline"
            title="Not saved. Your draft is still here."
            body={REFUSED[state.reason](biometricName)}
          />
        )}
        {state.kind === 'failed' && (
          <Notice
            tone="danger"
            icon="alert-circle-outline"
            title="Couldn't save securely"
            body="Nothing was stored. Your draft is still here, in memory only, so you can try again."
          />
        )}
        <DraftReceipt draft={draft} today={today} />
      </ScrollView>
      <View style={[styles.pad, styles.actions]}>
        <Key
          tone="loud"
          size="xlarge"
          icon={state.kind === 'failed' ? 'refresh' : BIOMETRIC_ICON[biometric]}
          label={saveLabel}
          disabled={state.kind === 'checking' || !ready}
          onPress={onSave}
          testID="add-save"
        />
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>Back to edit</Text>
        </Pressable>
        <ScreenshotsBlocked />
      </View>
      {discarding && (
        <DiscardDialog
          detail={`Sen drops the ${moneyText(signedMinor(draft.amountMinor), 'never')} you typed. Nothing was saved, so nothing else changes.`}
          onDiscard={onDiscard}
          onKeep={onKeep}
        />
      )}
    </View>
  );
}

function DraftReceipt({ draft, today }: { draft: DraftInput; today: DayKey }) {
  const { theme } = useUnistyles();
  const value = signed(minor(draft.amountMinor), draft.direction);
  const category = draft.category === null ? null : CATEGORY_LABEL[draft.category];
  const date = `${dayText(draft.day, true)}${draft.day === today ? ', today' : ''}`;
  const facts: readonly (readonly [string, string])[] = [
    ['CATEGORY', category ?? 'None'],
    ['DATE', date],
    ['ACCOUNT', `${DEMO_ACCOUNT.name} ·· ${DEMO_ACCOUNT.last4}`],
    ['SOURCE', 'Added on this phone'],
    ['STATUS', 'Posted'],
    ['TOTAL', moneyText(signedMinor(draft.amountMinor), 'never')],
  ];
  return (
    <View>
      <View style={styles.peek}>
        <Sen pose="peek" size={72} />
      </View>
      <ReceiptSlip>
        <View style={styles.slipTop}>
          <Text style={styles.caption}>{`SEN · SAVINGS ·· ${DEMO_ACCOUNT.last4}`}</Text>
          <Text style={styles.caption}>NEW ENTRY</Text>
        </View>
        <View style={styles.tag}>
          <Tag kind="draft" />
        </View>
        <View style={styles.hero}>
          {draft.category !== null && (
            <MaterialCommunityIcons
              name={CATEGORY_ICON[draft.category]}
              size={26}
              color={theme.colors.ink}
            />
          )}
          <Text style={styles.title}>{cleanDescription(draft)}</Text>
          {category !== null && <Text style={styles.muted}>{category}</Text>}
          <Amount value={value} size="hero" />
          <Text style={styles.caption}>
            {`${draft.direction === 'debit' ? 'MONEY OUT' : 'MONEY IN'} · ${dayText(draft.day, true).toUpperCase()}`}
          </Text>
        </View>
        <SlipRule />
        {facts.map(([label, text]) => (
          <View key={label} style={styles.fact}>
            <Text style={styles.factLabel}>{label}</Text>
            <Leader />
            <Text style={styles.factValue}>{text}</Text>
          </View>
        ))}
        <SlipRule />
        <View style={styles.reference}>
          <Text style={styles.caption}>REFERENCE · MADE ON THIS PHONE</Text>
          <Text style={styles.referenceCode}>{manualReference(draft.idemKey)}</Text>
        </View>
      </ReceiptSlip>
    </View>
  );
}

function announceAdded(db: Db, id: TxId, description: string): void {
  playHaptic('saved');
  toast.show({
    title: 'Added',
    detail: `${description} · stored encrypted`,
    action: {
      label: 'Undo',
      icon: 'undo',
      accessibilityLabel: 'Undo add',
      onPress: () => {
        void undoAdd(db, id).then((undone) => {
          if (!undone)
            toast.show({ title: 'Couldn’t undo', detail: 'The transaction is still saved.' });
        });
      },
    },
  });
}

export function ReviewStep(): ReactNode {
  const { draft } = useDraft();
  const db = useDb();
  const stepUp = useStepUp('add');
  const biometric = useBiometric();
  const router = useRouter();
  const guard = useCloseGuard(draft, false);
  const [state, setState] = useState<SaveState>({ kind: 'ready' });
  const saving = useRef(false);
  const today = todayInMalaysia();

  const save = async () => {
    const valid = toDraft(draft, today);
    if (saving.current || valid === null) return;
    saving.current = true;
    setState({ kind: 'checking' });
    const outcome = await saveDraft(db, valid, stepUp, toInstant(new Date()));
    saving.current = false;
    if (outcome.kind !== 'saved') {
      setState(outcome);
      return;
    }
    announceAdded(db, outcome.id, valid.description);
    router.dismissTo('/');
  };

  return (
    <ReviewView
      draft={draft}
      today={today}
      biometric={biometric.kind}
      state={state}
      discarding={guard.discarding}
      onSave={() => void save()}
      onBack={() => router.back()}
      onClose={guard.close}
      onDiscard={guard.discard}
      onKeep={guard.keep}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    paddingTop: rt.insets.top + 18,
    paddingBottom: rt.insets.bottom + 18,
    gap: 14,
    backgroundColor: theme.colors.canvas,
  },
  pad: { paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 16 },
  actions: { gap: 6 },
  back: { minHeight: theme.shape.touchMin, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  peek: { position: 'absolute', right: 18, top: -40 },
  slipTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { alignItems: 'flex-start', paddingTop: 10 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: theme.colors.ink },
  muted: { fontSize: 14, color: theme.colors.inkMuted },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  fact: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 6 },
  factLabel: { ...type.mono(11), letterSpacing: 0.9, color: theme.colors.inkMuted },
  factValue: { fontSize: 14, fontWeight: '600', textAlign: 'right', color: theme.colors.ink },
  reference: { gap: 4, paddingVertical: 8 },
  referenceCode: { ...type.mono(16, 600), color: theme.colors.ink },
}));
