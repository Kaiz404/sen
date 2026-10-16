import { type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { Bone } from '@/components/bone';
import { EnterOnce } from '@/components/enter-once';
import { Key } from '@/components/key';
import { Leader, ReceiptSlip, SlipRule } from '@/components/receipt-slip';
import { Segmented } from '@/components/segmented';
import { Stamp } from '@/components/stamp';
import { standIn } from '@/components/stand-in';
import { Tag, type TagKind } from '@/components/tag';
import { toast, type ToastSpec } from '@/components/toast';
import { signedMinor, type SignedMinor } from '@/models/money';
import { type } from '@/theme/type';

const noop = () => {};

type Row = {
  readonly title: string;
  readonly meta: string;
  readonly amount: SignedMinor;
  readonly tag?: TagKind;
};

const TODAY: readonly Row[] = [
  { title: 'Lunch with Hafiz, cash', meta: '1:42 pm', amount: signedMinor(-4250), tag: 'added' },
  { title: 'Tealive', meta: '1:15 pm', amount: signedMinor(-990), tag: 'pending' },
  {
    title: 'DuitNow from Aisyah Rahman',
    meta: 'Transfer in · 11:02 am',
    amount: signedMinor(35000),
  },
  { title: 'Grab ride to KL Sentral', meta: '8:42 am', amount: signedMinor(-1850), tag: 'pending' },
];
const DAY_NET = signedMinor(27910);

function SlipRow({ row, masked }: { row: Row; masked: boolean }) {
  return (
    <View style={styles.slipRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <View style={styles.rowMeta}>
          {row.tag !== undefined && <Tag kind={row.tag} />}
          <Text style={styles.muted}>{row.meta}</Text>
        </View>
      </View>
      <Amount value={masked ? null : row.amount} size="row" />
    </View>
  );
}

function DaySlip({ masked }: { masked: boolean }) {
  return (
    <ReceiptSlip>
      {TODAY.map((row, i) => (
        <View key={row.title}>
          {i > 0 && <SlipRule />}
          <SlipRow row={row} masked={masked} />
        </View>
      ))}
      <SlipRule />
      <View style={styles.net}>
        <Text style={styles.caption}>DAY NET</Text>
        <Leader />
        <Amount value={masked ? null : DAY_NET} size="net" />
      </View>
    </ReceiptSlip>
  );
}

function Loud({ children }: { children: ReactNode }) {
  return <View style={styles.loud}>{children}</View>;
}

function Stack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

function FilterDemo({ initial }: { initial: 'all' | 'in' | 'out' }) {
  const [value, setValue] = useState(initial);
  return (
    <Segmented
      accessibilityLabel="Show transactions"
      value={value}
      onChange={setValue}
      options={[
        { id: 'all', label: 'All' },
        { id: 'in', label: 'In', icon: 'arrow-bottom-left' },
        { id: 'out', label: 'Out', icon: 'arrow-top-right' },
      ]}
    />
  );
}

function DirectionDemo() {
  const [value, setValue] = useState<'out' | 'in'>('out');
  return (
    <Segmented
      accessibilityLabel="Money out or in"
      value={value}
      onChange={setValue}
      options={[
        { id: 'out', label: 'Money out', icon: 'arrow-top-right' },
        { id: 'in', label: 'Money in', icon: 'arrow-bottom-left' },
      ]}
    />
  );
}

/** Shows a toast through the real host while this state is on screen. */
function ToastDemo({ spec }: { spec: ToastSpec }) {
  useEffect(() => {
    const id = toast.show({ ...spec, ttl: 10 * 60_000 });
    return () => toast.hide(id);
  }, [spec]);
  return <Text style={styles.muted}>The toast sits at the bottom of the screen.</Text>;
}

const UNDO_TOAST: ToastSpec = {
  title: 'Deleted',
  detail: 'Lunch with Hafiz, cash · gone from this phone',
  action: { label: 'Undo', accessibilityLabel: 'Undo delete', icon: 'undo', onPress: noop },
};
const PLAIN_TOAST: ToastSpec = { title: 'Reference copied' };

function SkeletonSlip() {
  return (
    <ReceiptSlip>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.slipRow}>
          <Bone width={44} height={44} radius={22} />
          <View style={styles.rowText}>
            <Bone width="70%" height={14} />
            <Bone width="40%" height={10} />
          </View>
          <Bone width={64} height={16} />
        </View>
      ))}
    </ReceiptSlip>
  );
}

export const COMPONENT_STATES = {
  amount: {
    masked: () => (
      <Stack>
        <Amount value={null} size="hero" direction="debit" />
        <Amount value={null} size="card" direction="credit" />
        <Amount value={null} size="row" />
        <Amount value={null} size="net" />
      </Stack>
    ),
    revealed: () => (
      <Stack>
        <Amount value={signedMinor(-14260)} size="hero" />
        <Amount value={signedMinor(685000)} size="card" />
        <Amount value={signedMinor(-4250)} size="row" />
        <Amount value={signedMinor(35000)} size="row" />
        <Amount value={DAY_NET} size="net" />
      </Stack>
    ),
    loud: () => (
      <Loud>
        <Amount value={signedMinor(-231740)} size="hero" surface="loud" />
      </Loud>
    ),
  },
  key: {
    lemon: () => (
      <Key tone="lemon" size="large" icon="eye-outline" label="Show amounts" onPress={noop} />
    ),
    loud: () => (
      <Key
        tone="loud"
        icon="plus"
        label="Add"
        accessibilityLabel="Add a transaction"
        onPress={noop}
      />
    ),
    paper: () => (
      <View style={styles.inline}>
        <Key icon="cog-outline" accessibilityLabel="Settings" onPress={noop} />
        <Key icon="lock-outline" accessibilityLabel="Lock Sen now" onPress={noop} />
        <Key label="Clear search" icon="close" onPress={noop} />
      </View>
    ),
  },
  segmented: {
    all: () => <FilterDemo initial="all" />,
    in: () => <FilterDemo initial="in" />,
    direction: () => <DirectionDemo />,
  },
  'receipt-slip': {
    masked: () => <DaySlip masked />,
    revealed: () => <DaySlip masked={false} />,
  },
  stamp: {
    added: () => (
      <Stamp
        caption="ADDED BY"
        word="You"
        date="15·10·26"
        accessibilityLabel="Stamp: added by you"
      />
    ),
    pending: () => <Stamp caption="BELUM SELESAI" word="Pending" date="14·10·26" />,
  },
  tag: {
    pending: () => <Tag kind="pending" />,
    added: () => <Tag kind="added" />,
    draft: () => <Tag kind="draft" />,
  },
  toast: {
    undo: () => <ToastDemo spec={UNDO_TOAST} />,
    plain: () => <ToastDemo spec={PLAIN_TOAST} />,
  },
  'enter-once': {
    row: () => (
      <ReceiptSlip>
        <EnterOnce>
          <SlipRow row={TODAY[0]!} masked />
        </EnterOnce>
      </ReceiptSlip>
    ),
  },
  bone: {
    rows: () => <SkeletonSlip />,
  },
};

const styles = StyleSheet.create((theme, rt) => ({
  stack: { gap: 20, alignItems: 'flex-start' },
  inline: { flexDirection: 'row', gap: 10 },
  loud: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 30,
    backgroundColor: standIn(theme.colors, rt.themeName).loud,
  },
  slipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: theme.shape.touchMin,
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { fontSize: 13, color: theme.colors.inkMuted },
  net: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  caption: { ...type.caption(11), letterSpacing: 1.1, color: theme.colors.inkMuted },
}));
