import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Amount } from '@/components/amount';
import { Key } from '@/components/key';
import { SheetSurface } from '@/components/sheet-surface';
import { toast } from '@/components/toast';
import {
  type AuthFailure,
  type Biometric,
  useAmountsHidden,
  credentialName,
  useBiometric,
  useDb,
  useStepUp,
} from '@/features/auth';
import { PrivacyCover } from '@/features/security';
import { ADD_CATEGORIES, type CategoryId } from '@/models/category';
import { minor, type SignedMinor, signed } from '@/models/money';
import { capital } from '@/models/text';
import { type MaskedRow, type TxId, TxIdSchema } from '@/models/transaction';
import type { Db } from '@/services/db';
import { QK } from '@/services/query-client';
import { getRevealedTransaction, getTransaction } from '@/services/tx-repo';
import { type } from '@/theme/type';

import { undoDelete, deleteRow } from './actions';
import { BIOMETRIC_ICON, BIOMETRIC_NAME, CATEGORY_ICON, dayText } from './copy';
import { Notice } from './parts';

/** Where the confirm stands. A delete that lands leaves the sheet, so it has no state here. */
export type DeletePhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'refused'; readonly reason: Exclude<AuthFailure, 'cancelled'> }
  | { readonly kind: 'failed' };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const REFUSED: Readonly<Record<Exclude<AuthFailure, 'cancelled'>, (name: string) => string>> = {
  timedOut: () => 'The check timed out. Nothing was deleted.',
  mismatch: (name) => `${name} didn't match. Nothing was deleted.`,
  lockout: () => `Too many tries. Nothing was deleted. Use your ${credentialName()} next time.`,
  noLock: () => 'Nothing was deleted. Set a screen lock to use Sen.',
  not_set_up: (name) => `${name} is off. Nothing was deleted.`,
  unavailable: (name) => `${name} isn't available right now. Nothing was deleted.`,
  unknown: () => 'Something went wrong with the check. Nothing was deleted.',
};

export type DeleteViewProps = {
  /** Undefined while loading, null when the row is gone. */
  readonly row: MaskedRow | null | undefined;
  /** Null while amounts are hidden. */
  readonly amount: SignedMinor | null;
  readonly biometric: Biometric;
  readonly phase: DeletePhase;
  readonly onDelete: () => void;
  readonly onKeep: () => void;
};

export function DeleteView({
  row,
  amount,
  biometric,
  phase,
  onDelete,
  onKeep,
}: DeleteViewProps): ReactNode {
  if (row === undefined) return <SheetSurface />;
  if (row === null)
    return (
      <Ending
        icon="file-question-outline"
        title="This transaction isn't here any more."
        body="Nothing was deleted."
        onClose={onKeep}
      />
    );
  if (row.source === 'bank')
    return (
      <Ending
        icon="bank-outline"
        title="From your bank · read only"
        body="Bank rows come from Everyday Savings and can't be changed in Sen."
        onClose={onKeep}
      />
    );

  const name = BIOMETRIC_NAME[biometric];
  const label =
    phase.kind === 'checking'
      ? 'Checking it’s you…'
      : phase.kind === 'refused' || phase.kind === 'failed'
        ? `Try again with ${name}`
        : `Delete with ${name}`;
  const month = MONTHS[Number(row.day.slice(5, 7)) - 1];
  return (
    <SheetSurface>
      <Text accessibilityRole="header" style={styles.title}>
        Delete this transaction?
      </Text>
      <Text style={styles.body}>
        {`It's removed from this phone and from your ${month} totals. Bank rows aren't touched. You can undo for 6 seconds.`}
      </Text>
      <SheetRow row={row} amount={amount} />
      {phase.kind === 'refused' && (
        <Notice
          tone="danger"
          icon="alert-circle-outline"
          title={REFUSED[phase.reason](capital(name))}
        />
      )}
      {phase.kind === 'failed' && (
        <Notice
          tone="danger"
          icon="alert-circle-outline"
          title="Couldn't delete securely"
          body="Nothing was changed. Try again."
        />
      )}
      <Key
        tone="loud"
        size="xlarge"
        icon={BIOMETRIC_ICON[biometric]}
        label={label}
        disabled={phase.kind === 'checking'}
        onPress={onDelete}
        testID="delete-confirm"
      />
      <Key tone="outline" size="large" label="Keep it" onPress={onKeep} />
    </SheetSurface>
  );
}

function isAddCategory(id: CategoryId): id is (typeof ADD_CATEGORIES)[number] {
  return (ADD_CATEGORIES as readonly CategoryId[]).includes(id);
}

function SheetRow({ row, amount }: { row: MaskedRow; amount: SignedMinor | null }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={isAddCategory(row.category) ? CATEGORY_ICON[row.category] : 'dots-horizontal'}
        size={22}
        color={theme.colors.ink}
      />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {row.description}
        </Text>
        <Text style={styles.rowMeta}>{`${dayText(row.day)} · added by you`}</Text>
      </View>
      <Amount value={amount} size="row" direction={row.type} />
    </View>
  );
}

function Ending({
  icon,
  title,
  body,
  onClose,
}: {
  icon: 'file-question-outline' | 'bank-outline';
  title: string;
  body: string;
  onClose: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <SheetSurface>
      <MaterialCommunityIcons name={icon} size={28} color={theme.colors.ink} />
      <Text accessibilityRole="header" style={styles.endTitle}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <Key tone="outline" size="large" label="Close" onPress={onClose} />
    </SheetSurface>
  );
}

function announceDeleted(db: Db, id: TxId, description: string): void {
  toast.show({
    title: 'Deleted',
    detail: `${description} · gone from this phone`,
    action: {
      label: 'Undo',
      icon: 'undo',
      accessibilityLabel: 'Undo delete',
      onPress: () => {
        void undoDelete(db, id).then((restored) => {
          if (!restored)
            toast.show({ title: 'Couldn’t undo', detail: 'The transaction stays deleted.' });
        });
      },
    },
  });
}

export function DeleteSheet(): ReactNode {
  const params = useLocalSearchParams<{ id: string }>();
  const parsed = TxIdSchema.safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const db = useDb();
  const stepUp = useStepUp('delete');
  const biometric = useBiometric();
  const router = useRouter();
  const hidden = useAmountsHidden();
  const [phase, setPhase] = useState<DeletePhase>({ kind: 'ready' });
  const deleting = useRef(false);
  // The sheet keeps showing the row it deleted while it closes, instead of the refetch's "isn't here any more".
  const [gone, setGone] = useState<MaskedRow | null>(null);

  const row = useQuery({
    queryKey: [...QK.tx, 'delete-sheet', id],
    queryFn: () => (id === null ? null : getTransaction(db, id)),
  });
  const revealed = useQuery({
    queryKey: [...QK.revealed, 'delete-sheet', id],
    queryFn: () => (id === null ? null : getRevealedTransaction(db, id)),
    enabled: !hidden,
  });
  const amount =
    hidden || revealed.data == null
      ? null
      : signed(minor(revealed.data.amountMinor), revealed.data.type);

  const confirm = async () => {
    if (deleting.current || id === null || row.data == null) return;
    deleting.current = true;
    setPhase({ kind: 'checking' });
    const outcome = await deleteRow(db, id, stepUp);
    deleting.current = false;
    switch (outcome.kind) {
      case 'deleted':
        setGone(row.data);
        announceDeleted(db, id, row.data.description);
        router.dismissTo('/');
        return;
      case 'refused':
        setPhase(
          outcome.reason === 'cancelled'
            ? { kind: 'ready' }
            : { kind: 'refused', reason: outcome.reason },
        );
        return;
      case 'failed':
        setPhase(outcome);
        return;
      case 'read_only':
      case 'missing':
        setPhase({ kind: 'ready' });
        void row.refetch();
        return;
    }
  };

  return (
    <View>
      <DeleteView
        row={gone ?? (row.isError ? null : row.data)}
        amount={amount}
        biometric={biometric.kind}
        phase={phase}
        onDelete={() => void confirm()}
        onKeep={() => router.back()}
      />
      <PrivacyCover />
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  title: { ...type.words(30), color: theme.colors.ink },
  endTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.paper,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  rowMeta: { fontSize: 13, color: theme.colors.inkMuted },
}));
