import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { IconName } from '@/components/key';
import { cssMs } from '@/components/motion-level';
import { SlipRule } from '@/components/receipt-slip';
import { Segmented } from '@/components/segmented';
import { useMotionPolicy } from '@/motion/policy';
import { EASE_CSS } from '@/motion/tokens';
import { type ColorToken, GLYPH_PASTELS } from '@/theme/colors';
import { type } from '@/theme/type';

import type { Choice } from './copy';

export type Pastel = (typeof GLYPH_PASTELS)[number];

export const PASTEL = {
  rose: GLYPH_PASTELS[0],
  mint: GLYPH_PASTELS[1],
  lilac: GLYPH_PASTELS[2],
  butter: GLYPH_PASTELS[3],
  peach: GLYPH_PASTELS[4],
  sea: GLYPH_PASTELS[5],
} as const;

export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Card({ children }: { readonly children: ReactNode }): ReactNode {
  return <View style={styles.card}>{children}</View>;
}

/** The dashed hairline between a card's rows. */
export function Dash({ inset = true }: { readonly inset?: boolean }): ReactNode {
  return (
    <View style={styles.dash(inset)}>
      <SlipRule />
    </View>
  );
}

export function Badge({ label, tone }: { readonly label: string; readonly tone: ColorToken }) {
  return (
    <View style={styles.badge(tone)}>
      <Text style={styles.badgeText(tone)}>{label}</Text>
    </View>
  );
}

export function Chip({ icon, pastel }: { readonly icon: IconName; readonly pastel: Pastel }) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.chip, { backgroundColor: pastel }]} aria-hidden>
      <MaterialCommunityIcons name={icon} size={19} color={theme.colors.onPastel} />
    </View>
  );
}

function Titles({
  title,
  sub,
  danger = false,
}: {
  readonly title: string;
  readonly sub?: string;
  readonly danger?: boolean;
}) {
  return (
    <View style={styles.titles}>
      <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
      {sub !== undefined && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

/** The whole row is the switch, so the target is the row, not the 52 pt knob. */
export function SwitchRow({
  title,
  sub,
  chip,
  value,
  onChange,
  compact = false,
}: {
  readonly title: string;
  readonly sub?: string;
  readonly chip?: { readonly icon: IconName; readonly pastel: Pastel };
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  /** The reviewer slip's lighter rows: no chip, a smaller title. */
  readonly compact?: boolean;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={sub}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.row(compact)}
    >
      {chip !== undefined && <Chip icon={chip.icon} pastel={chip.pastel} />}
      {compact ? (
        <Text style={styles.compactTitle}>{title}</Text>
      ) : (
        <Titles title={title} sub={sub} />
      )}
      <Knob on={value} />
    </Pressable>
  );
}

const KNOB_MS = 150;

function Knob({ on }: { readonly on: boolean }) {
  const level = useMotionPolicy();
  return (
    <View style={styles.track(on)} aria-hidden>
      <Animated.View
        style={[
          styles.knob,
          {
            transform: [{ translateX: on ? 20 : 0 }],
            transitionProperty: 'transform',
            transitionDuration: cssMs(level, KNOB_MS),
            transitionTimingFunction: EASE_CSS.out,
          },
        ]}
      />
    </View>
  );
}

/** A setting with a few fixed values, drawn as the shared segmented control. */
export function ChoiceField<V extends string | number>({
  title,
  sub,
  choices,
  value,
  onChange,
  children,
}: {
  readonly title: string;
  readonly sub?: string;
  readonly choices: readonly Choice<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  readonly children?: ReactNode;
}): ReactNode {
  const byId = new Map(choices.map((c) => [String(c.id), c.id]));
  return (
    <View style={styles.field}>
      <Titles title={title} sub={sub} />
      <Segmented
        accessibilityLabel={title}
        options={choices.map((c) => ({ id: String(c.id), label: c.label, icon: c.icon }))}
        value={String(value)}
        onChange={(id) => {
          const next = byId.get(id);
          if (next !== undefined) onChange(next);
        }}
      />
      {children}
    </View>
  );
}

export function RadioGrid<V extends string>({
  legend,
  choices,
  value,
  onChange,
}: {
  readonly legend: string;
  readonly choices: readonly Choice<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
}): ReactNode {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={legend} style={styles.radioGroup}>
      <Text style={styles.legend}>{legend.toUpperCase()}</Text>
      <View style={styles.radioGrid}>
        {choices.map((c) => {
          const checked = c.id === value;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityLabel={c.label}
              accessibilityState={{ checked }}
              onPress={() => {
                if (!checked) onChange(c.id);
              }}
              style={styles.radio}
            >
              <View style={styles.dot(checked)}>{checked && <View style={styles.dotFill} />}</View>
              <Text style={styles.radioLabel}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function InfoRow({
  title,
  sub,
  chip,
  badge,
}: {
  readonly title: string;
  readonly sub: string;
  readonly chip: { readonly icon: IconName; readonly pastel: Pastel };
  readonly badge: string;
}): ReactNode {
  return (
    <View accessible accessibilityLabel={`${title}. ${sub}. ${badge}`} style={styles.row(false)}>
      <Chip icon={chip.icon} pastel={chip.pastel} />
      <Titles title={title} sub={sub} />
      <Badge label={badge} tone="inkMuted" />
    </View>
  );
}

export function NavRow({
  title,
  sub,
  chip,
  onPress,
  framed = false,
  danger = false,
  disabled = false,
  trailing,
  testID,
}: {
  readonly title: string;
  readonly sub?: string;
  readonly chip: { readonly icon: IconName; readonly pastel: Pastel };
  readonly onPress: () => void;
  /** A bordered button, as in the reviewer slip, rather than a card row. */
  readonly framed?: boolean;
  /** A destructive action, in the danger ink. */
  readonly danger?: boolean;
  /** Nothing to act on: dimmed, and a press does nothing. */
  readonly disabled?: boolean;
  readonly trailing?: ReactNode;
  readonly testID?: string;
}): ReactNode {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[framed ? styles.framed : styles.row(false), disabled && styles.disabled]}
    >
      <Chip icon={chip.icon} pastel={chip.pastel} />
      <Titles title={title} sub={sub} danger={danger} />
      {trailing ?? (
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.inkMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  disabled: { opacity: 0.5 },
  section: { gap: 8 },
  sectionTitle: { ...type.caption(11), color: theme.colors.inkMuted },
  card: { borderRadius: 22, backgroundColor: theme.colors.paper, overflow: 'hidden' },
  dash: (inset: boolean) => ({ marginHorizontal: inset ? 16 : 0 }),
  badge: (tone: ColorToken) => ({
    borderWidth: 1.5,
    borderRadius: 4,
    borderColor: theme.colors[tone],
    paddingHorizontal: 5,
    paddingVertical: 1,
  }),
  badgeText: (tone: ColorToken) => ({
    ...type.mono(10, 600),
    letterSpacing: 1,
    color: theme.colors[tone],
  }),
  chip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: theme.colors.ink },
  danger: { fontWeight: '700', color: theme.colors.danger },
  compactTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  sub: { fontSize: 12, lineHeight: 16, color: theme.colors.inkMuted },
  row: (compact: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: compact ? 54 : 60,
    paddingVertical: 8,
    paddingHorizontal: compact ? 0 : 16,
  }),
  track: (on: boolean) => ({
    width: 52,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.ink,
    padding: 2,
    backgroundColor: on ? theme.colors.mint : theme.colors.chip,
  }),
  knob: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.hero,
    backgroundColor: theme.colors.paper,
  },
  field: { gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  radioGroup: { gap: 2, marginTop: 6 },
  legend: { ...type.mono(11, 600), letterSpacing: 1.1, color: theme.colors.inkMuted },
  radioGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  radio: {
    width: '48%',
    minHeight: theme.shape.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: (checked: boolean) => ({
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: checked ? theme.colors.ink : 'transparent',
  }),
  dotFill: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.paper,
    backgroundColor: theme.colors.ink,
  },
  radioLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  framed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.keyEdge,
  },
}));
