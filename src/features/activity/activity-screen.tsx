import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Bone } from '@/components/bone';
import { Key } from '@/components/key';
import { ReceiptSlip, SlipRule } from '@/components/receipt-slip';
import { ScrollView } from '@/components/scroll-view';
import {
  type AuthFailure,
  BIOMETRIC,
  type BiometricCopy,
  useBiometric,
  useDb,
  useStepUp,
  credentialName,
} from '@/features/auth';
import { Sen } from '@/features/sen';
import { ACTIVITY_CAP } from '@/models/activity';
import { malaysiaDay, toInstant } from '@/models/day';
import { clearActivity, readActivity } from '@/services/activity-log';
import { GLYPH_PASTELS } from '@/theme/colors';
import { type } from '@/theme/type';

import { type ActivityDay, type ActivityItem, buildActivityDays, type Tint } from './days';

export type ClearState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'clearing' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> }
  | { readonly kind: 'failed' };

export type ActivityBody =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly days: readonly ActivityDay[]; readonly kept: number };

export type ActivityViewProps = {
  readonly body: ActivityBody;
  readonly sensor: BiometricCopy;
  readonly clear: ClearState;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onClear: () => void;
};

const REFUSED: Readonly<Record<Exclude<AuthFailure, 'cancelled'>, (name: string) => string>> = {
  timedOut: () => 'The check timed out. The log is as it was.',
  noLock: () => `The log is as it was. Set a ${credentialName()} to use Sen.`,
  unavailable: () => 'The check isn’t available right now. The log is as it was.',
  unknown: () => 'Something went wrong with the check. The log is as it was.',
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Glyph({ item }: { readonly item: ActivityItem }): ReactNode {
  const { theme } = useUnistyles();
  const background = item.tint === 'plain' ? theme.colors.chip : tint(item.tint);
  return (
    <View style={[styles.glyph, { backgroundColor: background }]} aria-hidden>
      <MaterialCommunityIcons name={item.icon} size={19} color={theme.colors.onPastel} />
    </View>
  );
}

const tint = (index: Exclude<Tint, 'plain'>) => GLYPH_PASTELS[index % GLYPH_PASTELS.length]!;

function Row({ item, first }: { readonly item: ActivityItem; readonly first: boolean }): ReactNode {
  return (
    <View
      testID="activity-row"
      accessible
      accessibilityLabel={[item.title, item.detail, item.time].filter(Boolean).join(', ')}
    >
      {!first && <SlipRule />}
      <View style={styles.row}>
        <Glyph item={item} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {item.detail !== null && (
            <Text numberOfLines={1} style={styles.rowDetail}>
              {item.detail}
            </Text>
          )}
        </View>
        <Text style={styles.time}>{item.time}</Text>
      </View>
    </View>
  );
}

function DaySlip({ day, withSen }: { readonly day: ActivityDay; readonly withSen: boolean }) {
  return (
    <View style={withSen ? styles.firstSlip : undefined}>
      {withSen && (
        <View style={styles.slipSen}>
          <Sen pose="peek" size={72} label="Sen, sitting on the edge of today’s log" />
        </View>
      )}
      <ReceiptSlip>
        <View accessibilityLabel={day.heading} style={styles.slip}>
          <Text accessibilityRole="header" style={styles.heading}>
            {day.heading}
          </Text>
          {day.items.map((item, i) => (
            <Row key={item.id} item={item} first={i === 0} />
          ))}
        </View>
      </ReceiptSlip>
    </View>
  );
}

function Skeleton(): ReactNode {
  return (
    <View testID="activity-loading" accessibilityLabel="Loading the log" style={styles.state}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.row}>
          <Bone width={36} height={36} radius={12} />
          <View style={styles.rowText}>
            <Bone width="70%" height={14} />
          </View>
          <Bone width={52} height={13} />
        </View>
      ))}
    </View>
  );
}

function Empty(): ReactNode {
  return (
    <View testID="activity-empty" style={styles.state}>
      <Sen pose="idle" size={120} />
      <Text accessibilityRole="header" style={styles.stateTitle}>
        Nothing yet
      </Text>
      <Text style={styles.stateBody}>
        Unlocks, reveals, adds and deletes show up here. Never amounts.
      </Text>
    </View>
  );
}

function Failed({ onRetry }: { readonly onRetry: () => void }): ReactNode {
  return (
    <View testID="activity-failed" style={styles.state}>
      <Sen pose="worried" size={120} />
      <Text accessibilityRole="header" style={styles.stateTitle}>
        Sen can’t read the log
      </Text>
      <Text style={styles.stateBody}>Nothing was changed. Try again.</Text>
      <Key tone="lemon" size="large" icon="refresh" label="Try again" onPress={onRetry} />
    </View>
  );
}

export function ActivityView({
  body,
  sensor,
  clear,
  onBack,
  onRetry,
  onClear,
}: ActivityViewProps): ReactNode {
  const { theme } = useUnistyles();
  const kept = body.kind === 'ready' ? body.kept : 0;
  return (
    <ScrollView testID="activity" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Key
          tone="paper"
          icon="arrow-left"
          accessibilityLabel="Back to settings"
          onPress={onBack}
        />
        <View style={styles.headerText}>
          <Text style={styles.caption}>SETTINGS · SECURITY</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {'Security\nactivity'}
          </Text>
        </View>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.deep} />
        <Text style={styles.noticeText}>
          {`Kept on this phone, encrypted. Last ${ACTIVITY_CAP} events. Never amounts.`}
        </Text>
      </View>

      {body.kind === 'loading' && <Skeleton />}
      {body.kind === 'failed' && <Failed onRetry={onRetry} />}
      {body.kind === 'ready' && body.days.length === 0 && <Empty />}
      {body.kind === 'ready' &&
        body.days.map((day, i) => <DaySlip key={day.key} day={day} withSen={i === 0} />)}

      {body.kind === 'ready' && body.days.length > 0 && (
        <>
          <Text style={styles.end}>{`START OF LOG · ${kept} OF ${ACTIVITY_CAP} KEPT`}</Text>
          <View style={styles.clear}>
            <Key
              tone="paper"
              size="large"
              icon="delete-outline"
              label={clear.kind === 'clearing' ? 'Clearing…' : 'Clear log'}
              disabled={clear.kind === 'clearing'}
              onPress={onClear}
            />
            {clear.kind === 'refused' && (
              <Text accessibilityRole="alert" style={styles.problem}>
                {REFUSED[clear.reason](sensor.name)}
              </Text>
            )}
            {clear.kind === 'failed' && (
              <Text accessibilityRole="alert" style={styles.problem}>
                Sen couldn’t clear the log. Nothing changed. Try again.
              </Text>
            )}
            <Text style={styles.clearNote}>
              {`${capital(sensor.name)} required. One entry stays: Log cleared.`}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

export const ACTIVITY_KEY = ['activity'] as const;

export function ActivityScreen(): ReactNode {
  const db = useDb();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sensor = BIOMETRIC[useBiometric().kind];
  const confirm = useStepUp('clearLog');
  const [clear, setClear] = useState<ClearState>({ kind: 'idle' });
  const log = useQuery({
    queryKey: ACTIVITY_KEY,
    queryFn: () => readActivity(db),
    refetchOnMount: 'always',
  });

  const body: ActivityBody = log.isError
    ? { kind: 'failed' }
    : log.data === undefined
      ? { kind: 'loading' }
      : {
          kind: 'ready',
          kept: log.data.entries.length,
          days: buildActivityDays(log.data.entries, malaysiaDay(toInstant(new Date())), sensor),
        };

  const onClear = async () => {
    if (clear.kind === 'clearing') return;
    setClear({ kind: 'clearing' });
    const auth = await confirm();
    if (!auth.ok) {
      setClear(
        auth.reason === 'cancelled' ? { kind: 'idle' } : { kind: 'refused', reason: auth.reason },
      );
      return;
    }
    try {
      await clearActivity(db);
      await queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY });
      setClear({ kind: 'idle' });
    } catch {
      setClear({ kind: 'failed' });
    }
  };

  return (
    <ActivityView
      body={body}
      sensor={sensor}
      clear={clear}
      onBack={() => router.back()}
      onRetry={() => void log.refetch()}
      onClear={() => void onClear()}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  content: {
    gap: 16,
    paddingTop: rt.insets.top + 16,
    paddingHorizontal: 16,
    paddingBottom: rt.insets.bottom + 24,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  headerText: { gap: 4 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  title: { ...type.words(50), lineHeight: 45, color: theme.colors.ink },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.inkMuted,
    borderRadius: 12,
  },
  noticeText: { ...type.mono(13), flex: 1, lineHeight: 19, color: theme.colors.ink },
  firstSlip: { marginTop: 44 },
  slipSen: { position: 'absolute', right: 18, top: -50, zIndex: 2 },
  slip: { paddingTop: 8, paddingBottom: 4 },
  heading: {
    ...type.mono(12, 600),
    letterSpacing: 1.4,
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 14,
    color: theme.colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2, paddingTop: 8 },
  rowTitle: { ...type.mono(14, 600), lineHeight: 20, color: theme.colors.ink },
  rowDetail: { ...type.mono(13), lineHeight: 18, color: theme.colors.inkMuted },
  time: { ...type.mono(13), paddingTop: 9, color: theme.colors.inkMuted },
  state: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  stateTitle: { ...type.words(30), color: theme.colors.ink },
  stateBody: { fontSize: 15, lineHeight: 21, textAlign: 'center', color: theme.colors.inkMuted },
  end: { ...type.caption(11), textAlign: 'center', color: theme.colors.inkMuted },
  clear: { gap: 10 },
  clearNote: { ...type.mono(12), textAlign: 'center', color: theme.colors.inkMuted },
  problem: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: theme.colors.danger },
}));
