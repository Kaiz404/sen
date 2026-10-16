import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { type IconName, Key } from '@/components/key';
import { ReceiptSlip } from '@/components/receipt-slip';
import { Tag } from '@/components/tag';
import { ADD_CATEGORIES, type AddCategoryId, CATEGORY_LABEL } from '@/models/category';
import { addDays, type DayKey } from '@/models/day';
import { DRAFT_LIMITS } from '@/models/draft';
import { minor, moneyText, signed, signedMinor } from '@/models/money';
import { type } from '@/theme/type';

import { todayInMalaysia, useDraft } from './add-layout';
import { CATEGORY_ICON, dayText, nearDayText } from './copy';
import { cleanDescription, type DraftInput, descriptionTooShort } from './draft';
import { DiscardDialog, FieldError, StepHeader } from './parts';
import { useCloseGuard } from './use-close-guard';

/** The add form never sends the description to anything that learns, suggests or fills in. */
const PRIVATE_INPUT = {
  autoCorrect: false,
  autoComplete: 'off',
  spellCheck: false,
  textContentType: 'none',
  importantForAutofill: 'no',
} as const;

export type DetailsViewProps = {
  readonly draft: DraftInput;
  readonly today: DayKey;
  /** Next was pressed with a field still missing, so the problems show. */
  readonly showProblems: boolean;
  readonly picking: boolean;
  readonly discarding: boolean;
  readonly onDescription: (text: string) => void;
  readonly onDescriptionDone: () => void;
  readonly onCategory: (category: AddCategoryId) => void;
  readonly onDay: (day: DayKey) => void;
  readonly onPick: (open: boolean) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
};

export function DetailsView(props: DetailsViewProps): ReactNode {
  const { draft, today, showProblems } = props;
  const { theme } = useUnistyles();
  const length = cleanDescription(draft).length;
  const tooShort = showProblems && descriptionTooShort(draft);
  const noCategory = showProblems && draft.category === null;
  return (
    <View style={styles.screen}>
      <View style={styles.pad}>
        <StepHeader step={2} onBack={props.onBack} onClose={props.onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.caption}>
            {draft.direction === 'debit' ? 'MONEY OUT' : 'MONEY IN'}
          </Text>
          <Text style={styles.summaryAmount}>
            {moneyText(signedMinor(draft.amountMinor), 'never')}
          </Text>
          <Pressable accessibilityRole="button" onPress={props.onBack} style={styles.link}>
            <Text style={styles.linkText}>Edit amount</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <View style={styles.fieldTop}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.caption}>AUTOCORRECT · AUTOFILL OFF</Text>
          </View>
          <TextInput
            {...PRIVATE_INPUT}
            accessibilityLabel="Description"
            value={draft.description}
            onChangeText={props.onDescription}
            onEndEditing={props.onDescriptionDone}
            maxLength={DRAFT_LIMITS.descriptionMax}
            placeholder="Lunch with Hafiz, cash"
            placeholderTextColor={theme.colors.inkMuted}
            returnKeyType="done"
            style={[styles.input, tooShort && styles.inputError]}
          />
          <View style={styles.fieldTop}>
            {tooShort ? (
              <FieldError text="Add at least 2 characters, like “Lunch with Hafiz”." />
            ) : (
              <Text style={styles.hint}>2 to 60 characters</Text>
            )}
            <Text style={styles.counter}>{`${length}/${DRAFT_LIMITS.descriptionMax}`}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={styles.chips}>
            {ADD_CATEGORIES.map((id) => (
              <CategoryChip
                key={id}
                id={id}
                selected={draft.category === id}
                onPress={() => props.onCategory(id)}
              />
            ))}
          </View>
          {noCategory && <FieldError text="Pick a category." />}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <DateChips day={draft.day} today={today} onDay={props.onDay} onPick={props.onPick} />
          <Text style={styles.hint}>
            {`Today is ${dayText(today)}. Any day in the last 90 days, never the future.`}
          </Text>
        </View>

        <Preview draft={draft} today={today} />
      </ScrollView>
      <View style={styles.pad}>
        <Key
          tone="loud"
          size="xlarge"
          label="Next"
          icon="chevron-right"
          iconPosition="end"
          onPress={props.onNext}
        />
      </View>
      {props.picking && (
        <DayPicker
          day={draft.day}
          today={today}
          onDay={(day) => {
            props.onDay(day);
            props.onPick(false);
          }}
          onClose={() => props.onPick(false)}
        />
      )}
      {props.discarding && (
        <DiscardDialog
          detail="Sen drops what you typed. Nothing was saved, so nothing else changes."
          onDiscard={props.onDiscard}
          onKeep={props.onKeep}
        />
      )}
    </View>
  );
}

function CategoryChip({
  id,
  selected,
  onPress,
}: {
  id: AddCategoryId;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={CATEGORY_LABEL[id]}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.chip(selected)}
    >
      <MaterialCommunityIcons name={CATEGORY_ICON[id]} size={20} color={theme.colors.ink} />
      <Text numberOfLines={1} style={styles.chipLabel}>
        {CATEGORY_LABEL[id]}
      </Text>
      {selected && (
        <MaterialCommunityIcons name="check" size={18} color={theme.colors.ink} aria-hidden />
      )}
    </Pressable>
  );
}

function DateChips({
  day,
  today,
  onDay,
  onPick,
}: {
  day: DayKey;
  today: DayKey;
  onDay: (day: DayKey) => void;
  onPick: (open: boolean) => void;
}) {
  const yesterday = addDays(today, -1);
  const picked = day !== today && day !== yesterday;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Date" style={styles.dates}>
      <DayChip label="Today" selected={day === today} onPress={() => onDay(today)} />
      <DayChip label="Yesterday" selected={day === yesterday} onPress={() => onDay(yesterday)} />
      <DayChip
        label={picked ? dayText(day) : 'Pick a date'}
        icon="calendar-blank-outline"
        selected={picked}
        onPress={() => onPick(true)}
      />
    </View>
  );
}

function DayChip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.dayChip(selected)}
    >
      {icon !== undefined && (
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={selected ? theme.colors.canvas : theme.colors.ink}
        />
      )}
      <Text style={styles.dayChipLabel(selected)}>{label}</Text>
    </Pressable>
  );
}

/** Every day the add window allows, newest first. No date beyond it can be picked. */
export function addWindow(today: DayKey): DayKey[] {
  return Array.from({ length: DRAFT_LIMITS.daysBack + 1 }, (_, i) => addDays(today, -i));
}

function DayPicker({
  day,
  today,
  onDay,
  onClose,
}: {
  day: DayKey;
  today: DayKey;
  onDay: (day: DayKey) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.scrim}>
      <View style={styles.backdrop} />
      <View accessibilityViewIsModal style={styles.picker}>
        <View style={styles.fieldTop}>
          <Text accessibilityRole="header" style={styles.pickerTitle}>
            Pick a date
          </Text>
          <Key icon="close" accessibilityLabel="Close date picker" onPress={onClose} />
        </View>
        <ScrollView accessibilityRole="radiogroup" contentContainerStyle={styles.pickerList}>
          {addWindow(today).map((d) => (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityLabel={pickerLabel(d, today)}
              accessibilityState={{ checked: d === day }}
              onPress={() => onDay(d)}
              style={styles.pickerRow(d === day)}
            >
              <Text style={styles.pickerLabel(d === day)}>{nearDayText(d, today)}</Text>
              {d !== today && d !== addDays(today, -1) ? null : (
                <Text style={styles.pickerAside(d === day)}>{dayText(d)}</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function pickerLabel(day: DayKey, today: DayKey): string {
  const near = nearDayText(day, today);
  const full = dayText(day);
  return near === full ? full : `${near}, ${full}`;
}

function Preview({ draft, today }: { draft: DraftInput; today: DayKey }) {
  const description = cleanDescription(draft);
  const category = draft.category === null ? 'No category yet' : CATEGORY_LABEL[draft.category];
  return (
    <View accessibilityLabel="Live preview" style={styles.preview}>
      <Text style={styles.caption}>LIVE PREVIEW</Text>
      <ReceiptSlip>
        <View style={styles.previewBody}>
          <Text style={styles.caption}>SEN · SAVINGS ·· 4821 · DRAFT</Text>
          <View style={styles.previewRow}>
            <View style={styles.previewText}>
              <Text numberOfLines={1} style={styles.previewTitle}>
                {description === '' ? 'Description' : description}
              </Text>
              <Text style={styles.hint}>{`${category} · ${nearDayText(draft.day, today)}`}</Text>
            </View>
            <Amount value={signed(minor(draft.amountMinor), draft.direction)} size="row" />
          </View>
          <View style={styles.previewTags}>
            <Tag kind="added" />
            <Text style={styles.caption}>NOT SAVED YET</Text>
          </View>
        </View>
      </ReceiptSlip>
    </View>
  );
}

export function DetailsStep(): ReactNode {
  const { draft, dispatch } = useDraft();
  const router = useRouter();
  const guard = useCloseGuard(draft, false);
  const [showProblems, setShowProblems] = useState(false);
  const [picking, setPicking] = useState(false);
  return (
    <DetailsView
      draft={draft}
      today={todayInMalaysia()}
      showProblems={showProblems}
      picking={picking}
      discarding={guard.discarding}
      onDescription={(text) => dispatch({ type: 'description', text })}
      onDescriptionDone={() => dispatch({ type: 'description', text: cleanDescription(draft) })}
      onCategory={(category) => dispatch({ type: 'category', category })}
      onDay={(day) => dispatch({ type: 'day', day })}
      onPick={setPicking}
      onNext={() => {
        if (descriptionTooShort(draft) || draft.category === null) setShowProblems(true);
        else router.push('/add/review');
      }}
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
    paddingBottom: rt.insets.bottom + 24,
    gap: 14,
    backgroundColor: theme.colors.canvas,
  },
  pad: { paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 22 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryAmount: { ...type.numerals(22), flex: 1, color: theme.colors.ink },
  link: { minHeight: theme.shape.touchMin, justifyContent: 'center' },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.ink,
    textDecorationLine: 'underline',
  },
  field: { gap: 10 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 17, fontWeight: '700', color: theme.colors.ink },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  hint: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  counter: { ...type.mono(12, 600), color: theme.colors.inkMuted },
  input: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.paper,
    fontSize: 17,
    color: theme.colors.ink,
  },
  inputError: { borderColor: theme.colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: (selected: boolean) => ({
    width: '48%',
    flexGrow: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: selected ? 5 : 2,
    borderColor: selected ? theme.colors.ink : theme.colors.rule,
    backgroundColor: theme.colors.paper,
  }),
  chipLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  dates: { flexDirection: 'row', gap: 8 },
  dayChip: (selected: boolean) => ({
    flexGrow: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: selected ? theme.colors.ink : theme.colors.rule,
    backgroundColor: selected ? theme.colors.ink : theme.colors.paper,
  }),
  dayChipLabel: (selected: boolean) => ({
    fontSize: 15,
    fontWeight: '700',
    color: selected ? theme.colors.canvas : theme.colors.ink,
  }),
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.hero, opacity: 0.5 },
  picker: {
    maxHeight: '75%',
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.canvas,
  },
  pickerTitle: { ...type.words(28), color: theme.colors.ink },
  pickerList: { gap: 6 },
  pickerRow: (selected: boolean) => ({
    minHeight: theme.shape.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: selected ? theme.colors.ink : theme.colors.paper,
  }),
  pickerLabel: (selected: boolean) => ({
    fontSize: 16,
    fontWeight: '600',
    color: selected ? theme.colors.canvas : theme.colors.ink,
  }),
  pickerAside: (selected: boolean) => ({
    ...type.mono(12),
    color: selected ? theme.colors.canvas : theme.colors.inkMuted,
  }),
  preview: { gap: 8 },
  previewBody: { gap: 10, paddingVertical: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewText: { flex: 1, gap: 2 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  previewTags: { flexDirection: 'row', alignItems: 'center', gap: 10 },
}));
