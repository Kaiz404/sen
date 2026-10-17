import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { type IconName, Key } from '@/components/key';
import { type } from '@/theme/type';

const STEPS = ['Amount', 'Details', 'Review'] as const;

export function StepHeader({
  step,
  onBack,
  onClose,
}: {
  readonly step: 1 | 2 | 3;
  readonly onBack?: () => void;
  readonly onClose: () => void;
}): ReactNode {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        {onBack === undefined ? (
          <View style={styles.spacer} />
        ) : (
          <Key icon="arrow-left" accessibilityLabel="Back" onPress={onBack} />
        )}
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${STEPS[step - 1]}, step ${step} of 3`}
          style={styles.title}
        >
          {STEPS[step - 1]}
        </Text>
        <Key icon="close" accessibilityLabel="Close" onPress={onClose} />
      </View>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={styles.progress}
      >
        {STEPS.map((name, i) => (
          <View key={name} style={styles.bar(i < step)} />
        ))}
      </View>
    </View>
  );
}

export type NoticeTone = 'calm' | 'danger';

/** An inline card for a state the user should read: a cancelled prompt, a failed write. */
export function Notice({
  tone,
  icon,
  title,
  body,
}: {
  readonly tone: NoticeTone;
  readonly icon: IconName;
  readonly title: string;
  readonly body?: string;
}): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice(tone)}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={tone === 'danger' ? theme.colors.danger : theme.colors.deep}
      />
      <View style={styles.noticeText}>
        <Text style={styles.noticeTitle}>{title}</Text>
        {body !== undefined && <Text style={styles.noticeBody}>{body}</Text>}
      </View>
    </View>
  );
}

export function FieldError({ text }: { readonly text: string }): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View accessibilityLiveRegion="polite" style={styles.fieldError}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.danger} />
      <Text style={styles.fieldErrorText}>{text}</Text>
    </View>
  );
}

/** "Discard this draft?" over the step. Closing with input always asks first. */
export function DiscardDialog({
  detail,
  onDiscard,
  onKeep,
}: {
  readonly detail: string;
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
}): ReactNode {
  return (
    <View style={styles.scrim}>
      <View style={styles.backdrop} />
      <View accessibilityViewIsModal style={styles.dialog}>
        <Text accessibilityRole="header" style={styles.dialogTitle}>
          Discard this draft?
        </Text>
        <Text style={styles.dialogBody}>{detail}</Text>
        <Key
          tone="loud"
          size="large"
          icon="delete-outline"
          label="Discard draft"
          onPress={onDiscard}
        />
        <Key tone="outline" size="large" label="Keep editing" onPress={onKeep} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerBlock: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 46 },
  title: { ...type.words(26), flex: 1, textAlign: 'center', color: theme.colors.ink },
  progress: { flexDirection: 'row', gap: 6 },
  bar: (done: boolean) => ({
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: done ? theme.colors.ink : theme.colors.rule,
  }),
  notice: (tone: NoticeTone) => ({
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: tone === 'danger' ? theme.colors.danger : theme.colors.rule,
    backgroundColor: theme.colors.paper,
  }),
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  noticeBody: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  fieldError: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldErrorText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.danger },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.hero, opacity: 0.5 },
  dialog: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.canvas,
  },
  dialogTitle: { ...type.words(28), color: theme.colors.ink },
  dialogBody: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted, marginBottom: 4 },
}));
