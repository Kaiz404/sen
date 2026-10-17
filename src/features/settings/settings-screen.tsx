import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useRef } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { ReceiptSlip } from '@/components/receipt-slip';
import { toast } from '@/components/toast';
import {
  type Biometric,
  lockNow,
  recordActivity,
  useBiometric,
  useDb,
} from '@/features/auth';
import { useAddedCount } from '@/features/security';
import { Sen } from '@/features/sen';
import { type SyncProgress, useSyncProgress } from '@/features/transactions';
import type { PrefKey, Prefs, PrefValue } from '@/models/prefs';
import { capital } from '@/models/text';
import { playHaptic } from '@/services/haptics';
import { readPref, writePref } from '@/services/prefs';
import { type } from '@/theme/type';

import { switchDataset, weakening } from './actions';
import {
  BIOMETRIC_ICON,
  BIOMETRIC_NAME,
  DATASET_CHOICES,
  datasetLine,
  IDLE_CHOICES,
  MOTION_CHOICES,
  NEXT_CHOICES,
  RELOCK_CHOICES,
  THEME_CHOICES,
} from './copy';
import {
  Badge,
  Card,
  ChoiceField,
  Dash,
  InfoRow,
  NavRow,
  PASTEL,
  RadioGrid,
  Section,
  SwitchRow,
} from './parts';
import { usePref } from './use-pref';

/** Prefs the screen writes straight through. Hiding amounts and the dataset size have their own actions. */
export type PlainPref = Exclude<PrefKey, 'demo.datasetSize'>;

export type SettingsValues = Pick<Prefs, PlainPref | 'demo.datasetSize'> & {
  readonly biometric: Biometric;
  /** How many rows the user added, or null while that loads. */
  readonly added: number | null;
  readonly progress: SyncProgress;
};

export type SettingsActions = {
  readonly onPref: <K extends PlainPref>(key: K, value: PrefValue<K>) => void;
  readonly onDataset: (size: PrefValue<'demo.datasetSize'>) => void;
  readonly onResetDemo: () => void;
  readonly onActivity: () => void;
  readonly onErase: () => void;
  readonly onLockNow: () => void;
  readonly onSignOut: () => void;
  readonly onBack: () => void;
};

/** Where the screen opens. History's fault states link straight to the reviewer controls. */
export type SettingsFocus = 'top' | 'reviewers';

export type SettingsViewProps = {
  readonly values: SettingsValues;
  readonly actions: SettingsActions;
  readonly focus: SettingsFocus;
};

/** What each OS really does, since only iOS draws a cover. Android blanks its recents card with FLAG_SECURE. */
const SWITCHER_ROW = {
  ios: { title: 'Hide Sen in the app switcher', sub: 'A cover with Sen asleep, no amounts' },
  android: {
    title: 'Blank preview in recent apps',
    sub: 'Recents shows nothing of Sen, no amounts',
  },
} as const;
const CAPTURE_ROW = {
  ios: { title: 'Block screenshots and recording', sub: 'Every screen in Sen, iOS 13+' },
  android: { title: 'Block screenshots and recording', sub: 'Every screen in Sen' },
} as const;

const VERSION = Constants.expoConfig?.version ?? '1.0.0';

export function SettingsView({ values, actions, focus }: SettingsViewProps): ReactNode {
  const scroll = useRef<ScrollView>(null);
  const focused = useRef(false);
  const name = BIOMETRIC_NAME[values.biometric];
  const motion = MOTION_CHOICES.find((c) => c.id === values.senMotion) ?? MOTION_CHOICES[0]!;
  const { onPref } = actions;

  return (
    <ScrollView
      ref={scroll}
      testID="settings"
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Key
          tone="paper"
          icon="arrow-left"
          accessibilityLabel="Back to history"
          onPress={actions.onBack}
        />
        <Text accessibilityRole="header" style={styles.heading}>
          Settings
        </Text>
      </View>

      <View style={styles.profile}>
        <View style={styles.profileSen}>
          <Sen pose="peek" size={64} label="Sen, peeking over your profile" />
        </View>
        <ReceiptSlip>
          <View style={styles.profileBody}>
            <Text style={styles.caption}>DEMO PROFILE</Text>
            <Text style={styles.profileName}>Demo user</Text>
            <View style={styles.profileLine}>
              <Text style={styles.account}>Everyday Savings ·· 4821</Text>
              <Badge label="SIMULATED DATA" tone="stamp" />
            </View>
          </View>
        </ReceiptSlip>
      </View>

      <Section title="APPEARANCE">
        <Card>
          <ChoiceField
            title="Theme"
            choices={THEME_CHOICES}
            value={values.theme}
            onChange={(v) => onPref('theme', v)}
          />
        </Card>
      </Section>

      <Section title="SECURITY">
        <Card>
          <ChoiceField
            title="Lock when idle"
            sub="App open, no touches"
            choices={IDLE_CHOICES}
            value={values.idleLock}
            onChange={(v) => onPref('idleLock', v)}
          />
          <Dash />
          <ChoiceField
            title="Lock again after leaving"
            choices={RELOCK_CHOICES}
            value={values.relockAfter}
            onChange={(v) => onPref('relockAfter', v)}
          />
          <Dash />
          <InfoRow
            title={`${capital(name)} for adding and deleting`}
            sub="Asks every time. Never remembered"
            chip={{ icon: BIOMETRIC_ICON[values.biometric], pastel: PASTEL.mint }}
            badge="ALWAYS ON"
          />
          <Dash />
          <InfoRow
            {...SWITCHER_ROW[Platform.OS === 'ios' ? 'ios' : 'android']}
            chip={{ icon: 'cellphone-lock', pastel: PASTEL.lilac }}
            badge="ALWAYS ON"
          />
          <Dash />
          <InfoRow
            {...CAPTURE_ROW[Platform.OS === 'ios' ? 'ios' : 'android']}
            chip={{ icon: 'cellphone-screenshot', pastel: PASTEL.peach }}
            badge="ALWAYS ON"
          />
          <Dash />
          <NavRow
            title="Security activity"
            sub="Last 50 events, on this phone"
            chip={{ icon: 'history', pastel: PASTEL.sea }}
            onPress={actions.onActivity}
          />
          <Dash />
          <NavRow
            title="Erase transactions I added"
            sub={
              values.added === 0
                ? 'You haven’t added any'
                : `${capital(name)} and confirm. Bank transactions stay`
            }
            chip={{ icon: 'delete-forever-outline', pastel: PASTEL.rose }}
            onPress={actions.onErase}
            disabled={values.added === 0}
            danger
          />
        </Card>
      </Section>

      <Section title="SEN">
        <Card>
          <ChoiceField
            title="Sen’s animations"
            choices={MOTION_CHOICES}
            value={values.senMotion}
            onChange={(v) => onPref('senMotion', v)}
          >
            <View style={styles.preview}>
              <View style={styles.previewTile}>
                <Sen pose={values.senMotion === 'off' ? 'idle' : 'happy'} size={44} />
              </View>
              <View style={styles.previewText}>
                <Text accessibilityLiveRegion="polite" style={styles.previewBlurb}>
                  {motion.blurb}
                </Text>
                <Text style={styles.previewNote}>REDUCE MOTION ON? SEN STAYS CALM</Text>
              </View>
            </View>
          </ChoiceField>
          <Dash />
          <SwitchRow
            title="Haptics"
            sub="One tap per moment: reveal, copy, errors"
            chip={{ icon: 'vibrate', pastel: PASTEL.mint }}
            value={values.haptics}
            onChange={(v) => onPref('haptics', v)}
          />
        </Card>
      </Section>

      <View
        onLayout={(e) => {
          if (focus !== 'reviewers' || focused.current) return;
          focused.current = true;
          scroll.current?.scrollTo({ y: e.nativeEvent.layout.y - 16, animated: false });
        }}
      >
        <Reviewers values={values} actions={actions} name={name} />
      </View>

      <Section title="ACCOUNT">
        <Key
          tone="lemon"
          size="xlarge"
          icon="lock-outline"
          label="Lock now"
          onPress={actions.onLockNow}
        />
        <NavRow
          title="Sign out of demo"
          sub="Wipes the rows you added too"
          chip={{ icon: 'logout', pastel: PASTEL.rose }}
          onPress={actions.onSignOut}
          framed
          danger
        />
      </Section>

      <Text style={styles.footer}>{`SEN ${VERSION} · SIMULATED DATA`}</Text>
    </ScrollView>
  );
}

function Reviewers({
  values,
  actions,
  name,
}: {
  readonly values: SettingsValues;
  readonly actions: SettingsActions;
  readonly name: string;
}): ReactNode {
  const { onPref } = actions;
  return (
    <ReceiptSlip>
      <View testID="reviewers" style={styles.reviewers}>
        <View style={styles.reviewersTop}>
          <Text accessibilityRole="header" style={styles.reviewersTitle}>
            For reviewers
          </Text>
          <Badge label="DEMO ONLY" tone="stamp" />
        </View>
        <Text style={styles.reviewersSub}>Make the next request misbehave on purpose.</Text>
        <RadioGrid
          legend="Next history request"
          choices={NEXT_CHOICES}
          value={values['demo.next']}
          onChange={(v) => onPref('demo.next', v)}
        />
        {values['demo.next'] === 'bad_data' && (
          <Text style={styles.reviewersSub}>
            Mixes 2 broken rows into the next request. Sen skips them and says so.
          </Text>
        )}
        <Text style={styles.note}>BACK TO NORMAL AFTER ONE REQUEST</Text>
        <Dash inset={false} />
        <View style={styles.dataset}>
          <ChoiceField
            title="Dataset size"
            sub={datasetLine(values.progress)}
            choices={DATASET_CHOICES}
            value={values['demo.datasetSize']}
            onChange={actions.onDataset}
          />
        </View>
        <Dash inset={false} />
        <SwitchRow
          compact
          title="Slow network, add 3 s"
          sub="Once per refresh, so loading shows"
          value={values['demo.slow']}
          onChange={(v) => onPref('demo.slow', v)}
        />
        <Dash inset={false} />
        <SwitchRow
          compact
          title="New transaction on refresh"
          value={values['demo.newOnRefresh']}
          onChange={(v) => onPref('demo.newOnRefresh', v)}
        />
        <Dash inset={false} />
        <View style={styles.reviewerKeys}>
          <NavRow
            framed
            title="Reset demo data"
            sub="Sample data and these controls start over"
            chip={{ icon: 'refresh', pastel: PASTEL.peach }}
            onPress={actions.onResetDemo}
          />
        </View>
      </View>
    </ReceiptSlip>
  );
}

export function SettingsScreen(): ReactNode {
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const biometric = useBiometric().kind;
  const progress = useSyncProgress();
  const added = useAddedCount();
  const values: SettingsValues = {
    biometric,
    added,
    progress,
    theme: usePref('theme'),
    idleLock: usePref('idleLock'),
    relockAfter: usePref('relockAfter'),
    senMotion: usePref('senMotion'),
    haptics: usePref('haptics'),
    'demo.next': usePref('demo.next'),
    'demo.datasetSize': usePref('demo.datasetSize'),
    'demo.slow': usePref('demo.slow'),
    'demo.newOnRefresh': usePref('demo.newOnRefresh'),
  };

  const actions: SettingsActions = {
    onPref: (key, value) => {
      const weakened = weakening(key, readPref(key), value);
      writePref(key, value);
      if (weakened !== null) recordActivity(weakened);
      playHaptic(key === 'theme' ? 'themeToggle' : 'segment');
    },
    onDataset: (size) => {
      if (progress !== null) return;
      playHaptic('segment');
      switchDataset(db, size).catch(() =>
        toast.show({ title: 'Couldn’t switch the dataset', detail: 'Your rows are as they were.' }),
      );
    },
    onResetDemo: () => router.push('/settings/reset-demo'),
    onActivity: () => router.push('/settings/activity'),
    onErase: () => router.push('/settings/erase'),
    onLockNow: lockNow,
    onSignOut: () => router.push('/settings/sign-out'),
    onBack: () => router.back(),
  };

  return (
    <SettingsView
      values={values}
      actions={actions}
      focus={params.focus === 'reviewers' ? 'reviewers' : 'top'}
    />
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  content: {
    gap: 18,
    paddingTop: rt.insets.top + 16,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heading: { ...type.words(54), lineHeight: 50, color: theme.colors.ink },
  profile: { marginTop: 40 },
  profileSen: { position: 'absolute', top: -58, right: 22 },
  profileBody: { gap: 6, paddingTop: 10, paddingBottom: 14, paddingHorizontal: 18 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  profileName: { ...type.words(36), lineHeight: 34, color: theme.colors.ink },
  profileLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  account: { ...type.mono(13), color: theme.colors.ink },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  previewTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.chip,
  },
  previewText: { flex: 1, gap: 4 },
  previewBlurb: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: theme.colors.ink },
  previewNote: { ...type.mono(10, 600), letterSpacing: 0.8, color: theme.colors.inkMuted },
  reviewers: { gap: 6, paddingTop: 10, paddingBottom: 16, paddingHorizontal: 16 },
  reviewersTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewersTitle: { ...type.words(28), color: theme.colors.ink },
  reviewersSub: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  note: { ...type.mono(10, 600), letterSpacing: 0.8, color: theme.colors.inkMuted },
  dataset: { marginHorizontal: -16 },
  reviewerKeys: { gap: 10, paddingTop: 12 },
  footer: {
    ...type.mono(11),
    letterSpacing: 0.9,
    textAlign: 'center',
    color: theme.colors.inkMuted,
  },
}));
