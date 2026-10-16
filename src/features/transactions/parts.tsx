import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, useUnistyles, withUnistyles } from 'react-native-unistyles';

import { Key } from '@/components/key';
import { Leader, perforation, SlipRule, zigzag } from '@/components/receipt-slip';
import { Segmented, type SegmentOption } from '@/components/segmented';
import { Tag } from '@/components/tag';
import type { Biometric } from '@/features/auth';
import { Sen } from '@/features/sen';
import type { DayKey } from '@/models/day';
import { type Direction, signed, type SignedMinor, signedMinor } from '@/models/money';
import type { TxId } from '@/models/transaction';
import type { Flow, MaskedTotals, RevealedTotals } from '@/services/tx-repo';
import { GLYPH_PASTELS } from '@/theme/colors';
import { type } from '@/theme/type';

import type { Banner } from './body';
import { RollAmount, useAmountView, useDayNetView, useRevealed } from './reveal';
import type { TxRowView } from './rows';

export const BIOMETRIC_NAME: Readonly<Record<Biometric, string>> = {
  faceId: 'Face ID',
  touchId: 'Touch ID',
  face: 'face unlock',
  fingerprint: 'fingerprint',
};

const BIOMETRIC_ICON = {
  faceId: 'face-recognition',
  touchId: 'fingerprint',
  face: 'face-recognition',
  fingerprint: 'fingerprint',
} as const satisfies Record<Biometric, string>;

export function Header({
  onAdd,
  inset,
  onSettings,
  onLock,
}: {
  /** False under the sync banner, which takes the status bar inset instead. */
  readonly inset: boolean;
  readonly onAdd: () => void;
  readonly onSettings: () => void;
  readonly onLock: () => void;
}): ReactNode {
  return (
    <View style={styles.header(inset)}>
      <View style={styles.brand}>
        <Sen pose="masked" size={34} />
        <Text style={styles.wordmark}>Sen</Text>
      </View>
      <View style={styles.keys}>
        <Key
          tone="loud"
          icon="plus"
          label="Add"
          accessibilityLabel="Add a transaction"
          onPress={onAdd}
        />
        <Key tone="paper" icon="cog" accessibilityLabel="Settings" onPress={onSettings} />
        <Key tone="paper" icon="lock-outline" accessibilityLabel="Lock Sen now" onPress={onLock} />
      </View>
    </View>
  );
}

/** The month card's Sen. Showing amounts plays Reveal on it, hiding plays Re-mask. */
const MONTH_SEN = 'month';

export function MonthTop({
  month,
  soFar,
  compact,
}: {
  readonly month: string;
  readonly soFar: string;
  readonly compact: boolean;
}): ReactNode {
  return (
    <View style={styles.monthTop}>
      <Text style={styles.account}>EVERYDAY SAVINGS ·· 4821</Text>
      <Text accessibilityRole="header" style={styles.month(compact)}>
        {month}
      </Text>
      {!compact && <Text style={styles.soFar}>{soFar}</Text>}
    </View>
  );
}

const FLOW_OPTIONS: readonly SegmentOption<Flow>[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'In', icon: 'arrow-bottom-left' },
  { id: 'out', label: 'Out', icon: 'arrow-top-right' },
];

export function SearchAndFilter({
  search,
  flow,
  onSearch,
  onFlow,
}: {
  readonly search: string;
  readonly flow: Flow;
  readonly onSearch: (text: string) => void;
  readonly onFlow: (flow: Flow) => void;
}): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View style={styles.filters}>
      <View style={styles.search}>
        <MaterialCommunityIcons
          name="magnify"
          size={21}
          color={theme.colors.inkMuted}
          style={styles.searchIcon}
        />
        <TextInput
          testID="history-search"
          accessibilityLabel="Search transactions"
          placeholder="Search Grab, TNB, DuitNow"
          placeholderTextColor={theme.colors.inkMuted}
          value={search}
          onChangeText={onSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search !== '' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => onSearch('')}
            style={styles.clear}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        )}
      </View>
      <Segmented
        options={FLOW_OPTIONS}
        value={flow}
        onChange={onFlow}
        accessibilityLabel="Show transactions"
      />
    </View>
  );
}

const net = (totals: RevealedTotals): SignedMinor =>
  signedMinor(totals.in.minor - totals.out.minor);

function side(flow: Flow): { readonly direction: Direction; readonly label: string } {
  return flow === 'in'
    ? { direction: 'credit', label: 'Money in' }
    : { direction: 'debit', label: 'Money out' };
}

export type CardProps = {
  readonly flow: Flow;
  readonly hidden: boolean;
  readonly counts: MaskedTotals | undefined;
  readonly asOf: string | null;
  readonly biometric: Biometric;
  readonly onShow: () => void;
  readonly onHide: () => void;
};

/** The month card. Lilac with coins while hidden, the loud fill with rolling digits while shown. */
export function MonthCard({
  flow,
  hidden,
  counts,
  asOf,
  biometric,
  onShow,
  onHide,
}: CardProps): ReactNode {
  const { theme } = useUnistyles();
  const totals = useRevealed()?.month;
  const main = side(flow);
  const heroMinor =
    totals === undefined ? null : flow === 'in' ? totals.in.minor : totals.out.minor;
  const hero = heroMinor === null ? null : signed(heroMinor, main.direction);
  const inMinor = totals === undefined ? null : signed(totals.in.minor, 'credit');
  const surface = hidden ? 'pastel' : 'loud';
  const label = asOf === null ? main.label : `${main.label} · as of ${asOf}`;
  const filtered = flow !== 'all';
  const count = flow === 'in' ? counts?.in.count : counts?.out.count;

  return (
    <View
      testID="month-card"
      accessibilityLabel={hidden ? 'Month summary, amounts hidden' : 'Month summary'}
      style={styles.card(hidden)}
    >
      <View style={styles.cardSen}>
        <Sen
          id={MONTH_SEN}
          pose={hidden ? 'masked' : 'revealed'}
          size={92}
          label={hidden ? 'Sen, eyes closed while amounts are hidden' : 'Sen, eyes open'}
        />
      </View>
      <Text style={styles.cardLabel(hidden)}>{label}</Text>
      <RollAmount
        value={hero}
        size="hero"
        surface={surface}
        sign={hero === null && flow !== 'in' ? 'never' : 'auto'}
        direction={main.direction}
      />
      {filtered ? (
        <View style={styles.cardLine}>
          <MaterialCommunityIcons
            name={flow === 'in' ? 'arrow-bottom-left' : 'arrow-top-right'}
            size={16}
            color={hidden ? theme.colors.onPastel : theme.colors.onLoud}
          />
          <Text style={styles.cardLineText(hidden)}>
            {count === undefined ? ' ' : `${count} ${count === 1 ? 'payment' : 'payments'} ${flow}`}
          </Text>
          <Text style={styles.cardLineCaption(hidden)}>
            {flow === 'in' ? 'OUT HIDDEN BY FILTER' : 'IN HIDDEN BY FILTER'}
          </Text>
        </View>
      ) : (
        <View style={styles.moneyIn}>
          <View style={styles.moneyInLabel}>
            <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={theme.colors.ink} />
            <Text style={styles.moneyInText}>Money in</Text>
          </View>
          <RollAmount value={inMinor} size="card" direction="credit" />
        </View>
      )}
      {hidden ? (
        <>
          <Key
            tone="lemon"
            size="large"
            icon={BIOMETRIC_ICON[biometric]}
            label="Show amounts"
            onPress={onShow}
          />
          <Text style={styles.cardNote}>
            {`Asks for ${BIOMETRIC_NAME[biometric]} first. Stays shown until you hide it.`}
          </Text>
        </>
      ) : (
        <Key
          tone="paper"
          size="large"
          icon="eye-off-outline"
          label="Hide amounts"
          onPress={onHide}
        />
      )}
    </View>
  );
}

export function LoadingCard(): ReactNode {
  return (
    <View accessibilityLabel="Loading your history" style={styles.card(true)}>
      <View style={styles.cardSen}>
        <Sen pose="lookdown" size={92} />
      </View>
      <Text style={styles.counting}>Counting your sen…</Text>
    </View>
  );
}

export function ResultLine({
  counts,
  hidden,
}: {
  readonly counts: MaskedTotals | undefined;
  readonly hidden: boolean;
}): ReactNode {
  const totals = useRevealed()?.results;
  const n = counts === undefined ? null : counts.in.count + counts.out.count;
  return (
    <View testID="result-line" style={styles.resultLine}>
      <Text style={styles.caption}>
        {n === null ? ' ' : `${n} ${n === 1 ? 'RESULT' : 'RESULTS'}`}
      </Text>
      <Leader />
      <RollAmount
        value={hidden || totals === undefined ? null : net(totals)}
        size="card"
        sign="auto"
      />
    </View>
  );
}

const SlipPath = withUnistyles(Path, (theme) => ({ fill: theme.colors.paper }));
const SLIP_SPAN = 616;
const PERFORATION = perforation(SLIP_SPAN);
const ZIGZAG = zigzag(SLIP_SPAN);

function SlipEdge({ d }: { d: string }): ReactNode {
  return (
    <View style={styles.edge} aria-hidden>
      <Svg width={SLIP_SPAN} height={8}>
        <SlipPath d={d} />
      </Svg>
    </View>
  );
}

export function DayTop({ title, caption }: { title: string; caption: string }): ReactNode {
  return (
    <View style={styles.dayTop}>
      <Text accessibilityRole="header" style={styles.dayTitle}>
        {title}
      </Text>
      {caption !== '' && <Text style={styles.dayCaption}>{caption}</Text>}
    </View>
  );
}

const SHAPES = [
  {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 23,
    borderBottomLeftRadius: 20,
  },
  {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 25,
    borderBottomRightRadius: 19,
    borderBottomLeftRadius: 24,
  },
  { borderRadius: 22 },
] as const;

type TxRowProps = {
  readonly row: TxRowView;
  readonly first: boolean;
  readonly onOpen: (id: TxId) => void;
};

/** One transaction. Its amount comes from `useAmountView`, never from the list data. */
export const TxRow = memo(function TxRow({ row, first, onOpen }: TxRowProps): ReactNode {
  const { theme } = useUnistyles();
  const amount = useAmountView(row.id);
  const credit = row.direction === 'credit';
  return (
    <View testID="tx-row" style={styles.slipCell}>
      {first ? (
        <SlipEdge d={PERFORATION} />
      ) : (
        <View style={styles.paper}>
          <SlipRule />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the transaction"
        onPress={() => onOpen(row.id)}
        style={styles.row}
      >
        <View
          style={[styles.glyph, { backgroundColor: GLYPH_PASTELS[row.tone] }, SHAPES[row.shape]]}
        >
          <MaterialCommunityIcons name={row.icon} size={22} color={theme.colors.onPastel} />
        </View>
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {row.title}
          </Text>
          <View style={styles.rowMeta}>
            {row.tag !== null && <Tag kind={row.tag} />}
            <Text numberOfLines={1} style={styles.rowDetail}>
              {row.detail === null ? row.time : `${row.detail} · ${row.time}`}
            </Text>
          </View>
        </View>
        <View style={styles.rowEnd}>
          <RollAmount
            value={amount === null ? null : signed(amount, row.direction)}
            size="row"
            sign="auto"
          />
          <View style={styles.chip(credit)}>
            <MaterialCommunityIcons
              name={credit ? 'arrow-bottom-left' : 'arrow-top-right'}
              size={13}
              color={credit ? theme.colors.deep : theme.colors.ink}
            />
            <Text style={styles.chipText(credit)}>{credit ? 'In' : 'Out'}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export function DayNet({ day, label }: { day: DayKey; label: string }): ReactNode {
  const value = useDayNetView(day);
  return (
    <View testID="day-net" style={styles.slipCell}>
      <View style={styles.paper}>
        <SlipRule />
        <View style={styles.net}>
          <Text style={styles.netLabel}>{label}</Text>
          <Leader />
          <RollAmount value={value} size="net" sign="auto" />
        </View>
      </View>
      <SlipEdge d={ZIGZAG} />
    </View>
  );
}

const BANNER_COPY: Readonly<Record<Banner['kind'], string>> = {
  offline: "You're offline",
  timeout: 'Taking too long',
  server: 'Something broke on our side',
};

export function SyncBanner({
  banner,
  onRetry,
}: {
  readonly banner: Banner;
  readonly onRetry: () => void;
}): ReactNode {
  return (
    <View testID="sync-banner" accessibilityRole="alert" style={styles.banner}>
      <Sen pose="worried" size={52} />
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{BANNER_COPY[banner.kind]}</Text>
        <Text style={styles.bannerDetail}>
          {banner.since === null
            ? 'Showing what Sen saved.'
            : `Showing history from ${banner.since}.`}
        </Text>
      </View>
      <Key tone="lemon" icon="refresh" label="Retry" onPress={onRetry} />
    </View>
  );
}

export function NoteLine({
  text,
  icon,
}: {
  text: string;
  icon: 'alert-circle-outline' | 'database-refresh';
}): ReactNode {
  const { theme } = useUnistyles();
  return (
    <View style={styles.note}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.colors.inkMuted} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  header: (inset: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: (inset ? rt.insets.top : 0) + 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: theme.colors.canvas,
  }),
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { ...type.words(28), color: theme.colors.ink },
  keys: { flexDirection: 'row', gap: 10 },
  monthTop: { gap: 6 },
  account: { ...type.caption(11), color: theme.colors.inkMuted },
  month: (compact: boolean) => ({
    ...type.words(compact ? 44 : 92),
    lineHeight: compact ? 44 : 80,
    paddingTop: compact ? 0 : 6,
    color: theme.colors.ink,
  }),
  soFar: { fontFamily: type.numerals(17).fontFamily, fontSize: 17, color: theme.colors.inkMuted },
  filters: { gap: 10 },
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 16, zIndex: 1 },
  searchInput: {
    height: 50,
    paddingLeft: 46,
    paddingRight: 44,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.paper,
    color: theme.colors.ink,
    fontSize: 16,
  },
  clear: {
    position: 'absolute',
    right: 4,
    width: theme.shape.touchMin,
    height: theme.shape.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: (hidden: boolean) => ({
    marginTop: 30,
    borderRadius: 30,
    padding: 18,
    paddingTop: 20,
    gap: 14,
    backgroundColor: hidden ? theme.colors.lilac : theme.colors.loud,
  }),
  cardSen: { position: 'absolute', top: -50, right: 14 },
  cardLabel: (hidden: boolean) => ({
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: hidden ? theme.colors.onPastel : theme.colors.onLoud,
  }),
  cardLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardLineText: (hidden: boolean) => ({
    fontSize: 14,
    fontWeight: '600',
    color: hidden ? theme.colors.onPastel : theme.colors.onLoud,
  }),
  cardLineCaption: (hidden: boolean) => ({
    ...type.caption(10),
    marginLeft: 'auto',
    color: hidden ? theme.colors.onPastel : theme.colors.onLoud,
  }),
  cardNote: { fontSize: 13, textAlign: 'center', color: theme.colors.onPastel },
  counting: { ...type.words(34), color: theme.colors.onPastel, paddingVertical: 24 },
  moneyIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.paper,
  },
  moneyInLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moneyInText: { fontSize: 14, fontWeight: '600', color: theme.colors.inkMuted },
  resultLine: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  caption: { ...type.caption(11), color: theme.colors.inkMuted },
  edge: { height: 8, overflow: 'hidden' },
  dayTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: theme.colors.canvas,
  },
  dayTitle: { ...type.words(30), color: theme.colors.ink },
  dayCaption: { ...type.mono(11, 600), letterSpacing: 1.1, color: theme.colors.inkMuted },
  slipCell: { paddingHorizontal: 20 },
  paper: { backgroundColor: theme.colors.paper },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: theme.shape.touchMin,
    backgroundColor: theme.colors.paper,
  },
  glyph: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDetail: { flexShrink: 1, fontSize: 13, color: theme.colors.inkMuted },
  rowEnd: { alignItems: 'flex-end', gap: 5 },
  chip: (credit: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
    paddingLeft: 4,
    paddingRight: 7,
    borderRadius: 10,
    backgroundColor: credit ? theme.colors.mint : theme.colors.chip,
  }),
  chipText: (credit: boolean) => ({
    fontSize: 11,
    fontWeight: '700',
    color: credit ? theme.colors.onPastel : theme.colors.ink,
  }),
  net: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  netLabel: { ...type.mono(11, 600), letterSpacing: 1.1, color: theme.colors.inkMuted },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: rt.insets.top,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 16,
    backgroundColor: theme.colors.hero,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...type.numerals(16), color: theme.colors.onHero },
  bannerDetail: { fontSize: 13, color: theme.colors.onHeroMuted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  noteText: { flex: 1, fontSize: 13, color: theme.colors.inkMuted },
}));
