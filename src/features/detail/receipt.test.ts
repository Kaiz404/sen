import { type MaskedRow, MaskedRowSchema } from '@/models/transaction';

import { addedText, heroCaption, paymentSteps, receiptFacts, stampDate } from './receipt';

const TNB: MaskedRow = MaskedRowSchema.parse({
  id: 'bk-1',
  currency: 'MYR',
  type: 'debit',
  description: 'TNB electricity',
  merchant: 'Tenaga Nasional Berhad',
  category: 'bills',
  status: 'pending',
  postedAt: '2026-10-14T10:20:00.000Z',
  day: '2026-10-14',
  reference: 'FT26101400478213',
  account: { name: 'Everyday Savings', last4: '4821' },
  source: 'bank',
});

const SALARY = MaskedRowSchema.parse({
  ...TNB,
  type: 'credit',
  category: 'income',
  status: 'posted',
  merchant: 'Acme',
  postedAt: '2026-10-12T16:05:00.000Z',
  day: '2026-10-13',
});

const LUNCH = MaskedRowSchema.parse({
  ...TNB,
  id: 'm-1',
  description: 'Lunch with Hafiz, cash',
  merchant: 'Lunch with Hafiz, cash',
  category: 'food',
  status: 'posted',
  postedAt: '2026-10-15T05:42:00.000Z',
  day: '2026-10-15',
  source: 'manual',
});

test('a pending bank row lists its merchant, ledger side and pending status', () => {
  expect(receiptFacts(TNB)).toEqual([
    { label: 'MERCHANT', text: 'Tenaga Nasional Berhad', tone: 'plain' },
    { label: 'CATEGORY', text: 'Bills & utilities', tone: 'plain' },
    { label: 'DATE & TIME', text: 'Wed 14 Oct 2026, 6:20 pm', tone: 'plain' },
    { label: 'ACCOUNT', text: 'Everyday Savings ·· 4821', tone: 'plain' },
    { label: 'TYPE', text: 'Debit, money out', tone: 'plain' },
    { label: 'STATUS', text: 'Pending', tone: 'pending' },
  ]);
});

test('a posted credit after midnight Malaysia time reads on the Malaysia day', () => {
  expect(receiptFacts(SALARY).slice(2)).toEqual([
    { label: 'DATE & TIME', text: 'Tue 13 Oct 2026, 12:05 am', tone: 'plain' },
    { label: 'ACCOUNT', text: 'Everyday Savings ·· 4821', tone: 'plain' },
    { label: 'TYPE', text: 'Credit, money in', tone: 'plain' },
    { label: 'STATUS', text: 'Posted', tone: 'plain' },
  ]);
  expect(heroCaption(SALARY)).toBe('MONEY IN · TUE 13 OCT 2026 · 12:05 AM');
});

test('an added row has no merchant line and reads its type plainly', () => {
  expect(receiptFacts(LUNCH).map((f) => `${f.label}=${f.text}`)).toEqual([
    'CATEGORY=Food & drink',
    'DATE & TIME=Thu 15 Oct 2026, 1:42 pm',
    'ACCOUNT=Everyday Savings ·· 4821',
    'TYPE=Money out',
    'STATUS=Posted',
  ]);
  expect(addedText(LUNCH)).toBe('Added on this phone, 15 Oct 1:42 pm');
});

test('the stamp date is day, month and two-digit year', () => {
  expect(stampDate(TNB.day)).toBe('14·10·26');
});

test('a pending bank payment tracks Authorised, Pending and Posted; posted and added rows have no timeline', () => {
  expect(paymentSteps(TNB)).toEqual([
    { label: 'Authorised', state: 'done', caption: 'WED 6:20 PM' },
    { label: 'Pending', state: 'now', caption: 'NOW' },
    { label: 'Posted', state: 'next', caption: 'NEXT' },
  ]);
  expect(paymentSteps(SALARY)).toBeNull();
  expect(paymentSteps(MaskedRowSchema.parse({ ...LUNCH, status: 'pending' }))).toBeNull();
});
