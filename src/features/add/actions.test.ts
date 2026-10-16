import type { StepUpResult } from '@/features/auth';
import { arrivals } from '@/features/transactions';
import { DayKeySchema, InstantSchema } from '@/models/day';
import { type Draft, draftSchema } from '@/models/draft';
import { TxIdSchema } from '@/models/transaction';
import { createMockBank } from '@/services/bank-api';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { sync } from '@/services/sync';
import { getTransaction } from '@/services/tx-repo';

import { deleteRow, saveDraft, undoAdd, undoDelete } from './actions';

jest.mock('@/services/logger');

const NOW = InstantSchema.parse('2026-10-15T08:00:00.000Z');
const TODAY = DayKeySchema.parse('2026-10-15');
const DRAFT: Draft = draftSchema(TODAY).parse({
  idemKey: '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b',
  amountMinor: 4250,
  direction: 'debit',
  description: 'Lunch with Hafiz, cash',
  category: 'food',
  day: '2026-10-15',
});
const ADDED = TxIdSchema.parse('m-7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b');
const BANK = TxIdSchema.parse('bk-20');

const passes = () => jest.fn(async (): Promise<StepUpResult> => ({ ok: true }));
const cancels = () =>
  jest.fn(async (): Promise<StepUpResult> => ({ ok: false, reason: 'cancelled' }));

let db: OpenDb;

beforeEach(async () => {
  db = await openTestDb();
  const scenario = { next: 'normal', size: 20, slow: false, newOnRefresh: false } as const;
  await sync(db, createMockBank({ now: () => NOW }).under(scenario), { now: () => NOW });
});

afterEach(() => {
  arrivals.setState({ after: null, added: null });
  return db.close();
});

async function manualRows(): Promise<unknown[]> {
  return [...(await db.all("SELECT id, description FROM tx WHERE source = 'manual'"))];
}

test('a cancelled step-up writes nothing', async () => {
  expect(await saveDraft(db, DRAFT, cancels(), NOW)).toEqual({
    kind: 'refused',
    reason: 'cancelled',
  });
  expect(await manualRows()).toEqual([]);
});

test('a saved draft is marked to slide in, and a cancelled one is not', async () => {
  await saveDraft(db, DRAFT, cancels(), NOW);
  expect(arrivals.getState().added).toBeNull();

  await saveDraft(db, DRAFT, passes(), NOW);
  expect(arrivals.getState().added).toBe(ADDED);
});

test('a passed step-up stores the draft once, however many times it is saved', async () => {
  const stepUp = passes();
  const first = await saveDraft(db, DRAFT, stepUp, NOW);
  const second = await saveDraft(db, DRAFT, stepUp, NOW);

  expect([first, second]).toEqual([
    { kind: 'saved', id: ADDED },
    { kind: 'saved', id: ADDED },
  ]);
  expect(stepUp).toHaveBeenCalledTimes(2);
  expect(await manualRows()).toEqual([{ id: ADDED, description: 'Lunch with Hafiz, cash' }]);
});

test('a write that commits but never answers fails, and Retry stores no second row', async () => {
  let answered = false;
  const flaky: OpenDb = {
    ...db,
    all: db.all.bind(db),
    run: db.run.bind(db),
    close: db.close.bind(db),
    transaction: async (work) => {
      const result = await db.transaction(work);
      if (answered) return result;
      answered = true;
      throw new Error('disk I/O error');
    },
  };

  expect(await saveDraft(flaky, DRAFT, passes(), NOW)).toEqual({ kind: 'failed' });
  expect(await saveDraft(flaky, DRAFT, passes(), NOW)).toEqual({ kind: 'saved', id: ADDED });
  expect(await manualRows()).toEqual([{ id: ADDED, description: 'Lunch with Hafiz, cash' }]);
});

test('undo of an add removes the row without a prompt', async () => {
  await saveDraft(db, DRAFT, passes(), NOW);
  expect(await undoAdd(db, ADDED)).toBe(true);
  expect(await manualRows()).toEqual([]);
});

test('delete refuses a bank row before any prompt', async () => {
  const stepUp = passes();
  expect(await deleteRow(db, BANK, stepUp)).toEqual({ kind: 'read_only' });
  expect(stepUp).not.toHaveBeenCalled();
  expect((await getTransaction(db, BANK))?.source).toBe('bank');
});

test('a missing row asks for nothing', async () => {
  const stepUp = passes();
  expect(await deleteRow(db, ADDED, stepUp)).toEqual({ kind: 'missing' });
  expect(stepUp).not.toHaveBeenCalled();
});

test('a refused delete keeps the row', async () => {
  await saveDraft(db, DRAFT, passes(), NOW);
  expect(await deleteRow(db, ADDED, cancels())).toEqual({ kind: 'refused', reason: 'cancelled' });
  expect(await manualRows()).toEqual([{ id: ADDED, description: 'Lunch with Hafiz, cash' }]);
});

test('a delete with step-up removes the row, and undo restores the same row without a prompt', async () => {
  await saveDraft(db, DRAFT, passes(), NOW);
  const before = await getTransaction(db, ADDED);

  expect(await deleteRow(db, ADDED, passes())).toEqual({ kind: 'deleted' });
  expect(await getTransaction(db, ADDED)).toBeNull();

  expect(await undoDelete(db, ADDED)).toBe(true);
  expect(await getTransaction(db, ADDED)).toEqual(before);
});
