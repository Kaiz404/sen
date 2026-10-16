import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { toast, ToastHost } from '@/components/toast';
import type { StepUpResult } from '@/features/auth';
import { DayKeySchema } from '@/models/day';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { queryClient } from '@/services/query-client';

import { DraftProvider } from './add-layout';
import { AmountStep } from './amount-step';
import { DetailsStep } from './details-step';
import { type DraftInput, newDraft } from './draft';
import { ReviewStep } from './review-step';

let mockDb: OpenDb;
const mockStepUp = jest.fn<Promise<StepUpResult>, []>();
const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
}));
jest.mock('@/features/auth', () => ({
  useDb: () => mockDb,
  useStepUp: () => mockStepUp,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
}));

const NOW = new Date('2026-10-15T06:00:00.000Z');
const TODAY = DayKeySchema.parse('2026-10-15');
const KEY = '7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const FILLED: DraftInput = {
  ...newDraft(KEY, TODAY),
  amountMinor: 4250,
  description: 'Lunch with Hafiz, cash',
  category: 'food',
};

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  mockStepUp.mockReset();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  queryClient.clear();
  mockDb = await openTestDb();
});
afterEach(async () => {
  await act(async () => toast.hide());
  await mockDb.close();
  jest.useRealTimers();
});

function renderStep(step: ReactNode, draft: DraftInput = newDraft(KEY, TODAY)) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftProvider start={() => draft}>{step}</DraftProvider>
      <ToastHost />
    </QueryClientProvider>,
  );
}

async function manualRows() {
  return [...(await mockDb.all("SELECT id, description FROM tx WHERE source = 'manual'"))];
}

function deferred() {
  let resolve: (result: StepUpResult) => void = () => {};
  const promise = new Promise<StepUpResult>((r) => (resolve = r));
  return { promise, resolve };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test('keys fill the amount from the right, and Next waits for one', async () => {
  await renderStep(<AmountStep />);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

  for (const key of ['4', '2', '5', '0']) await press(key);

  expect(screen.getByTestId('add-amount')).toHaveAccessibleName('RM 42.50');
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  await press('Next');
  expect(mockRouter.push).toHaveBeenCalledWith('/add/details');
});

test('an amount over RM 50,000.00 says so and cannot go on', async () => {
  await renderStep(<AmountStep />);
  for (const key of ['5', '2', '0', 'Double zero', 'Double zero']) await press(key);

  expect(screen.getByTestId('add-amount')).toHaveAccessibleName('RM 52,000.00');
  expect(
    screen.getByText("That's over the limit. One transaction can be up to RM 50,000.00."),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('close with input asks first, and Keep editing keeps the draft', async () => {
  await renderStep(<AmountStep />);
  await press('4');
  await press('Close');

  expect(screen.getByRole('header', { name: 'Discard this draft?' })).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Sen drops the RM 0.04 you typed. Nothing was saved, so nothing else changes.',
    ),
  ).toBeOnTheScreen();
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();

  await press('Keep editing');
  expect(screen.queryByText('Discard this draft?')).toBeNull();
  expect(screen.getByTestId('add-amount')).toHaveAccessibleName('RM 0.04');

  await press('Close');
  await press('Discard draft');
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
});

test('close with no input leaves at once', async () => {
  await renderStep(<AmountStep />);
  await press('Close');
  expect(screen.queryByText('Discard this draft?')).toBeNull();
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
});

test('the description field never learns or fills in', async () => {
  await renderStep(<DetailsStep />, { ...FILLED, description: '' });
  expect(screen.getByLabelText('Description').props).toMatchObject({
    autoCorrect: false,
    autoComplete: 'off',
    spellCheck: false,
    textContentType: 'none',
    importantForAutofill: 'no',
    maxLength: 60,
  });
});

test('the sanitiser reaches the field: the counter and the stored text are the cleaned text', async () => {
  await renderStep(<DetailsStep />, { ...FILLED, description: '' });
  const field = screen.getByLabelText('Description');

  await fireEvent.changeText(field, '  Lunch​  with‮ Hafiz,\u0007 cash ');
  expect(screen.getByText('22/60')).toBeOnTheScreen();

  await fireEvent(field, 'endEditing');
  expect(screen.getByLabelText('Description').props.value).toBe('Lunch with Hafiz, cash');
});

test('Next with a short description and no category shows both problems', async () => {
  await renderStep(<DetailsStep />, { ...FILLED, description: ' L​ ', category: null });
  await press('Next');

  expect(screen.getByText('Add at least 2 characters, like “Lunch with Hafiz”.')).toBeOnTheScreen();
  expect(screen.getByText('Pick a category.')).toBeOnTheScreen();
  expect(mockRouter.push).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Description'), 'Lunch');
  await fireEvent.press(screen.getByRole('radio', { name: 'Food & drink' }));
  await press('Next');
  expect(mockRouter.push).toHaveBeenCalledWith('/add/review');
});

test('Pick a date offers today back to 90 days ago and nothing else', async () => {
  await renderStep(<DetailsStep />, FILLED);
  await fireEvent.press(screen.getByRole('radio', { name: 'Pick a date' }));

  expect(screen.getByRole('radio', { name: 'Today, Thu 15 Oct' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Yesterday, Wed 14 Oct' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Fri 17 Jul' })).toBeOnTheScreen();
  expect(screen.queryByRole('radio', { name: 'Thu 16 Jul' })).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Fri 16 Oct' })).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'Mon 5 Oct' }));
  expect(screen.getByRole('radio', { name: 'Mon 5 Oct' })).toBeChecked();
});

test('a double tap on Save prompts once and stores one row, then Undo removes it without a prompt', async () => {
  const check = deferred();
  mockStepUp.mockReturnValueOnce(check.promise);
  await renderStep(<ReviewStep />, FILLED);

  await press('Save with fingerprint');
  expect(screen.getByRole('button', { name: 'Checking it’s you…' })).toBeDisabled();
  await fireEvent.press(screen.getByTestId('add-save'));
  await act(async () => check.resolve({ ok: true }));

  expect(mockStepUp).toHaveBeenCalledTimes(1);
  expect(await manualRows()).toEqual([{ id: `m-${KEY}`, description: 'Lunch with Hafiz, cash' }]);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  expect(screen.getByText('Lunch with Hafiz, cash · stored encrypted')).toBeOnTheScreen();

  await press('Undo add');
  expect(await manualRows()).toEqual([]);
  expect(mockStepUp).toHaveBeenCalledTimes(1);
});

test('a cancelled prompt writes nothing and keeps the draft on review', async () => {
  mockStepUp.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
  await renderStep(<ReviewStep />, FILLED);

  await press('Save with fingerprint');

  expect(screen.getByText('Not saved. Your draft is still here.')).toBeOnTheScreen();
  expect(
    screen.getByText("Fingerprint was cancelled. Save again when you're ready."),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Save with fingerprint' })).toBeEnabled();
  expect(await manualRows()).toEqual([]);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});

test('a store that fails says nothing was stored, and Retry prompts again and saves', async () => {
  mockStepUp.mockResolvedValue({ ok: true });
  const real = mockDb;
  let failing = true;
  mockDb = {
    ...real,
    transaction: (work) =>
      failing ? Promise.reject(new Error('disk I/O error')) : real.transaction(work),
  };
  await renderStep(<ReviewStep />, FILLED);

  await press('Save with fingerprint');
  expect(screen.getByText("Couldn't save securely")).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Nothing was stored. Your draft is still here, in memory only, so you can try again.',
    ),
  ).toBeOnTheScreen();
  expect(await manualRows()).toEqual([]);

  failing = false;
  await press('Retry with fingerprint');
  expect(mockStepUp).toHaveBeenCalledTimes(2);
  expect(await manualRows()).toEqual([{ id: `m-${KEY}`, description: 'Lunch with Hafiz, cash' }]);
});
