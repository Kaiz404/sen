import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { toast } from '@/components/toast';

import {
  hideAmounts,
  lockNow,
  showAmounts,
  useAmountsHidden,
  useBiometric,
  useDb,
} from '@/features/auth';
import { Sen } from '@/features/sen';
import type { Revealed } from '@/features/transactions';
import { type TxId, TxIdSchema } from '@/models/transaction';
import { copySensitive } from '@/services/clipboard';
import { playHaptic } from '@/services/haptics';
import { QK } from '@/services/query-client';
import { getRevealedTransaction, getTransaction } from '@/services/tx-repo';

import { type DetailBody, DetailView } from './detail-view';

export const detailKeys = {
  row: (id: TxId | null) => [...QK.tx, 'detail', id] as const,
  amount: (id: TxId | null) => [...QK.revealed, 'detail', id] as const,
};

const COPIED_MS = 2500;

/** The route param is untrusted: a bad id is a missing row, never a throw. */
function parseId(raw: unknown): TxId | null {
  const parsed = TxIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function DetailScreen(): ReactNode {
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseId(params.id);
  const db = useDb();
  const router = useRouter();
  const hidden = useAmountsHidden();
  const biometric = useBiometric().kind;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const row = useQuery({
    queryKey: detailKeys.row(id),
    queryFn: () => (id === null ? null : getTransaction(db, id)),
  });
  const amount = useQuery({
    queryKey: detailKeys.amount(id),
    queryFn: () => (id === null ? null : getRevealedTransaction(db, id)),
    select: (tx) => tx?.amountMinor ?? null,
    enabled: !hidden && id !== null,
  });

  const body: DetailBody = row.isError
    ? { kind: 'failed' }
    : row.data === undefined
      ? { kind: 'loading' }
      : row.data === null
        ? { kind: 'missing' }
        : { kind: 'found', row: row.data };
  const copy = async (reference: string) => {
    if (!(await copySensitive(reference))) {
      toast.show({ title: 'Couldn’t copy', detail: 'Press and hold the reference to copy it.' });
      return;
    }
    playHaptic('copy');
    setCopied(true);
    toast.show({
      title: 'Reference copied',
      ttl: COPIED_MS,
      mark: <Sen pose={hidden ? 'masked' : 'revealed'} size={26} />,
    });
  };

  const revealed: Revealed | null =
    hidden || id === null || amount.data == null ? null : { amounts: new Map([[id, amount.data]]) };

  return (
    <DetailView
      body={body}
      hidden={hidden}
      revealed={revealed}
      biometric={biometric}
      copied={copied}
      actions={{
        onBack: () => (router.canGoBack() ? router.back() : router.replace('/')),
        onLock: lockNow,
        onShow: () => {
          void showAmounts().then((outcome) => {
            if (!outcome.ok) return;
            playHaptic('reveal');
            AccessibilityInfo.announceForAccessibility('Amounts shown');
          });
        },
        onHide: () => {
          hideAmounts();
          playHaptic('hideNow');
          AccessibilityInfo.announceForAccessibility('Amounts hidden');
        },
        onDelete: () => {
          if (id !== null) router.push(`/transaction/${id}/delete`);
        },
        onRetry: () => void row.refetch(),
        onCopy: () => {
          if (row.data != null) void copy(row.data.reference);
        },
      }}
    />
  );
}
