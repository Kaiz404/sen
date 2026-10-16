import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { Key } from '@/components/key';
import { Segmented, type SegmentOption } from '@/components/segmented';
import { Sen } from '@/features/sen';
import { type Direction, moneyText, signedMinor } from '@/models/money';
import { playHaptic } from '@/services/haptics';
import { type } from '@/theme/type';

import { useDraft } from './add-layout';
import { amountProblem } from './draft';
import { PAD_KEYS, type PadKey } from './keypad-reducer';
import { DiscardDialog, FieldError, StepHeader } from './parts';
import { useCloseGuard } from './use-close-guard';

const DIRECTIONS: readonly SegmentOption<Direction>[] = [
  { id: 'debit', label: 'Money out', icon: 'arrow-top-right' },
  { id: 'credit', label: 'Money in', icon: 'arrow-bottom-left' },
];

const KEY_LABEL: Partial<Record<PadKey, string>> = {
  '00': 'Double zero',
  back: 'Delete last digit',
};

export type AmountViewProps = {
  readonly amountMinor: number;
  readonly direction: Direction;
  readonly discarding: boolean;
  readonly onKey: (key: PadKey) => void;
  readonly onDirection: (direction: Direction) => void;
  readonly onNext: () => void;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
};

export function AmountView({
  amountMinor,
  direction,
  discarding,
  onKey,
  onDirection,
  onNext,
  onClose,
  onDiscard,
  onKeep,
}: AmountViewProps): ReactNode {
  const problem = amountProblem(amountMinor);
  const value = signedMinor(amountMinor);
  return (
    <View style={styles.screen}>
      <StepHeader step={1} onClose={onClose} />
      <Segmented
        options={DIRECTIONS}
        value={direction}
        onChange={onDirection}
        accessibilityLabel="Direction"
      />
      <View style={styles.amount}>
        <View style={styles.sen}>
          <Sen pose="look" size={64} label="Sen, leaning in to watch the amount" />
        </View>
        <Text style={styles.caption}>
          {direction === 'debit' ? 'AMOUNT · MONEY OUT' : 'AMOUNT · MONEY IN'}
        </Text>
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={moneyText(value, 'never')}
          testID="add-amount"
        >
          <Amount value={value} size="hero" sign="never" />
        </View>
      </View>
      {problem === 'over_limit' ? (
        <FieldError text="That's over the limit. One transaction can be up to RM 50,000.00." />
      ) : (
        <Text style={styles.hint}>
          Digits fill from the right, like an ATM. Type 4 2 5 0 for RM 42.50.
        </Text>
      )}
      <View style={styles.fill} />
      <PrivacyNote />
      <View accessibilityLabel="Amount keypad" style={styles.pad}>
        {PAD_KEYS.map((key) => (
          <PadButton key={key} padKey={key} onPress={() => onKey(key)} />
        ))}
      </View>
      <Key
        tone="loud"
        size="xlarge"
        label="Next"
        icon="chevron-right"
        iconPosition="end"
        disabled={problem !== null}
        onPress={onNext}
      />
      {discarding && (
        <DiscardDialog detail={discardDetail(amountMinor)} onDiscard={onDiscard} onKeep={onKeep} />
      )}
    </View>
  );
}

export function discardDetail(amountMinor: number): string {
  const what = amountMinor > 0 ? `the ${moneyText(signedMinor(amountMinor), 'never')}` : 'what';
  return `Sen drops ${what} you typed. Nothing was saved, so nothing else changes.`;
}

function PrivacyNote() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.note}>
      <MaterialCommunityIcons name="lock-outline" size={17} color={theme.colors.deep} />
      <Text style={styles.noteText}>
        Sen&apos;s own keypad. Amounts never pass through your phone&apos;s keyboard, so
        autocorrect, predictions and keyboard apps never see them.
      </Text>
    </View>
  );
}

function PadButton({ padKey, onPress }: { padKey: PadKey; onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={KEY_LABEL[padKey] ?? padKey}
      onPress={onPress}
      style={({ pressed }) => [styles.padKey, pressed && styles.padKeyDown]}
    >
      {padKey === 'back' ? (
        <MaterialCommunityIcons name="backspace-outline" size={26} color={theme.colors.ink} />
      ) : (
        <Text style={styles.padLabel}>{padKey}</Text>
      )}
    </Pressable>
  );
}

export function AmountStep(): ReactNode {
  const { draft, dispatch } = useDraft();
  const router = useRouter();
  const guard = useCloseGuard(draft, true);
  return (
    <AmountView
      amountMinor={draft.amountMinor}
      direction={draft.direction}
      discarding={guard.discarding}
      onKey={(key) => dispatch({ type: 'key', key })}
      onDirection={(direction) => {
        playHaptic('segment');
        dispatch({ type: 'direction', direction });
      }}
      onNext={() => router.push('/add/details')}
      onClose={guard.close}
      onDiscard={guard.discard}
      onKeep={guard.keep}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: 14,
    paddingTop: rt.insets.top + 18,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 24,
    backgroundColor: theme.colors.canvas,
  },
  amount: { alignItems: 'flex-end', gap: 6, paddingTop: 10 },
  sen: { position: 'absolute', left: -38, top: 58 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  hint: {
    alignSelf: 'flex-end',
    maxWidth: 260,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    color: theme.colors.inkMuted,
  },
  fill: { flex: 1 },
  note: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.paper,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  padKey: {
    width: '31%',
    flexGrow: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: theme.colors.keyEdge,
    backgroundColor: theme.colors.paper,
  },
  padKeyDown: { borderBottomWidth: 2, transform: [{ translateY: 4 }] },
  padLabel: { ...type.numerals(28), color: theme.colors.ink },
}));
