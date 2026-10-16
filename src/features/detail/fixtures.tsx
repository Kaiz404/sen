import type { ReactNode } from 'react';

import type { Revealed } from '@/features/transactions';
import { MinorSchema } from '@/models/money';
import { type MaskedRow, MaskedRowSchema } from '@/models/transaction';

import { type DetailActions, DetailView, type DetailViewProps } from './detail-view';

const noop = () => {};

const NO_ACTIONS: DetailActions = {
  onBack: noop,
  onLock: noop,
  onShow: noop,
  onHide: noop,
  onDelete: noop,
  onRetry: noop,
  onCopy: noop,
  onShare: noop,
};

const ACCOUNT = { name: 'Everyday Savings', last4: '4821' };

/** The boards' detail sample: TNB electricity, pending, RM 142.60. */
const TNB: MaskedRow = MaskedRowSchema.parse({
  id: 'bk-board-tnb',
  currency: 'MYR',
  type: 'debit',
  description: 'TNB electricity',
  merchant: 'Tenaga Nasional Berhad',
  category: 'bills',
  status: 'pending',
  postedAt: '2026-10-14T10:20:00.000Z',
  day: '2026-10-14',
  reference: 'FT26101400478213',
  account: ACCOUNT,
  source: 'bank',
});

const SALARY: MaskedRow = MaskedRowSchema.parse({
  ...TNB,
  id: 'bk-board-salary',
  type: 'credit',
  description: 'Salary · [EMPLOYER]',
  merchant: '[EMPLOYER]',
  category: 'income',
  status: 'posted',
  postedAt: '2026-10-13T01:00:00.000Z',
  day: '2026-10-13',
  reference: 'FT26101300120934',
});

const LUNCH: MaskedRow = MaskedRowSchema.parse({
  ...TNB,
  id: 'm-board-lunch',
  description: 'Lunch with Hafiz, cash',
  merchant: 'Lunch with Hafiz, cash',
  category: 'food',
  status: 'posted',
  postedAt: '2026-10-15T05:42:00.000Z',
  day: '2026-10-15',
  reference: 'SEN-M-7Q4K2D9X',
  source: 'manual',
});

const shown = (row: MaskedRow, sen: number): Revealed => ({
  amounts: new Map([[row.id, MinorSchema.parse(sen)]]),
});

const BASE: DetailViewProps = {
  body: { kind: 'found', row: TNB },
  hidden: true,
  revealed: null,
  biometric: 'fingerprint',
  copied: false,
  actions: NO_ACTIONS,
};

const found = (row: MaskedRow) => ({ kind: 'found', row }) as const;

export const DETAIL_STATES = {
  masked: () => <DetailView {...BASE} />,
  shown: () => <DetailView {...BASE} hidden={false} revealed={shown(TNB, 14260)} />,
  copied: () => <DetailView {...BASE} hidden={false} revealed={shown(TNB, 14260)} copied />,
  'posted-in': () => (
    <DetailView {...BASE} body={found(SALARY)} hidden={false} revealed={shown(SALARY, 650000)} />
  ),
  manual: () => <DetailView {...BASE} body={found(LUNCH)} />,
  'manual-shown': () => (
    <DetailView {...BASE} body={found(LUNCH)} hidden={false} revealed={shown(LUNCH, 4250)} />
  ),
  loading: () => <DetailView {...BASE} body={{ kind: 'loading' }} />,
  'not-found': () => <DetailView {...BASE} body={{ kind: 'missing' }} />,
  failed: () => <DetailView {...BASE} body={{ kind: 'failed' }} />,
} satisfies Record<string, () => ReactNode>;
