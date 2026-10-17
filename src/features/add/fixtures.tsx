import type { ReactNode } from 'react';

import { addDays, DayKeySchema } from '@/models/day';
import { type MaskedRow, MaskedRowSchema } from '@/models/transaction';

import { AmountView } from './amount-step';
import { type DeletePhase, DeleteView } from './delete-sheet';
import { DetailsView } from './details-step';
import { type DraftInput, newDraft } from './draft';
import { ReviewView, type SaveState } from './review-step';

const noop = () => {};
const TODAY = DayKeySchema.parse('2026-10-15');
const DRAFT: DraftInput = {
  ...newDraft('7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b', TODAY),
  amountMinor: 4250,
  description: 'Lunch with Hafiz, cash',
  category: 'food',
};

const ROW = {
  id: 'm-7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b',
  currency: 'MYR',
  type: 'debit',
  description: 'Lunch with Hafiz, cash',
  merchant: 'Lunch with Hafiz, cash',
  category: 'food',
  status: 'posted',
  postedAt: '2026-10-15T05:42:00.000Z',
  reference: 'SEN-M-7Q4K2D9X',
  account: { name: 'Everyday Savings', last4: '4821' },
  source: 'manual',
  day: '2026-10-15',
};
const MANUAL: MaskedRow = MaskedRowSchema.parse(ROW);
const BANK: MaskedRow = MaskedRowSchema.parse({ ...ROW, id: 'bk-20', source: 'bank' });

function Amount({
  amountMinor,
  discarding = false,
}: {
  amountMinor: number;
  discarding?: boolean;
}) {
  return (
    <AmountView
      amountMinor={amountMinor}
      direction="debit"
      discarding={discarding}
      onKey={noop}
      onDirection={noop}
      onNext={noop}
      onClose={noop}
      onDiscard={noop}
      onKeep={noop}
    />
  );
}

function Details({
  draft = DRAFT,
  showProblems = false,
}: {
  draft?: DraftInput;
  showProblems?: boolean;
}) {
  return (
    <DetailsView
      draft={draft}
      today={TODAY}
      showProblems={showProblems}
      picker={null}
      discarding={false}
      onDescription={noop}
      onDescriptionDone={noop}
      onCategory={noop}
      onDay={noop}
      onPick={noop}
      onNext={noop}
      onBack={noop}
      onClose={noop}
      onDiscard={noop}
      onKeep={noop}
    />
  );
}

function Review({ state, draft = DRAFT }: { state: SaveState; draft?: DraftInput }) {
  return (
    <ReviewView
      draft={draft}
      today={TODAY}
      biometric="fingerprint"
      state={state}
      discarding={false}
      onSave={noop}
      onBack={noop}
      onClose={noop}
      onDiscard={noop}
      onKeep={noop}
    />
  );
}

function Delete({ row = MANUAL, phase }: { row?: MaskedRow | null; phase: DeletePhase }) {
  return (
    <DeleteView
      row={row}
      amount={null}
      biometric="fingerprint"
      phase={phase}
      onDelete={noop}
      onKeep={noop}
    />
  );
}

export const ADD_STATES = {
  'amount-empty': () => <Amount amountMinor={0} />,
  'amount-typed': () => <Amount amountMinor={4250} />,
  'amount-over-limit': () => <Amount amountMinor={5_200_000} />,
  'amount-max': () => <Amount amountMinor={9_999_999} />,
  'amount-discard': () => <Amount amountMinor={4250} discarding />,
  'details-filled': () => <Details />,
  'details-problems': () => (
    <Details draft={{ ...DRAFT, description: 'L', category: null }} showProblems />
  ),
  'details-picked': () => <Details draft={{ ...DRAFT, day: addDays(TODAY, -12) }} />,
  'review-ready': () => <Review state={{ kind: 'ready' }} />,
  'review-checking': () => <Review state={{ kind: 'checking' }} />,
  'review-cancelled': () => <Review state={{ kind: 'refused', reason: 'cancelled' }} />,
  'review-date-expired': () => (
    <Review state={{ kind: 'ready' }} draft={{ ...DRAFT, day: addDays(TODAY, -91) }} />
  ),
  'review-failed': () => <Review state={{ kind: 'failed' }} />,
  'delete-confirm': () => <Delete phase={{ kind: 'ready' }} />,
  'delete-checking': () => <Delete phase={{ kind: 'checking' }} />,
  'delete-refused': () => <Delete phase={{ kind: 'refused', reason: 'unavailable' }} />,
  'delete-bank': () => <Delete row={BANK} phase={{ kind: 'ready' }} />,
  'delete-gone': () => <Delete row={null} phase={{ kind: 'ready' }} />,
} satisfies Record<string, () => ReactNode>;
