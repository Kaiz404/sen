import { render } from '@testing-library/react-native';

import { noteDraftDroppedByLock } from '@/features/auth';
import { DayKeySchema } from '@/models/day';

import { DraftProvider, DroppedDraftWatch } from './add-layout';
import { type DraftInput, newDraft } from './draft';

jest.mock('expo-router', () => ({ Stack: () => null }));
jest.mock('@/features/auth', () => ({ noteDraftDroppedByLock: jest.fn() }));

const TODAY = DayKeySchema.parse('2026-10-15');
const BLANK = newDraft('7f3c2a10-4b5d-4e6f-8a9b-0c1d2e3f4a5b', TODAY);
const TYPED: DraftInput = { ...BLANK, amountMinor: 4250 };

function mountFlow(draft: DraftInput) {
  return render(
    <DraftProvider start={() => draft}>
      <DroppedDraftWatch />
    </DraftProvider>,
  );
}

beforeEach(() => jest.mocked(noteDraftDroppedByLock).mockClear());

test('leaving the add flow with a typed draft reports it to the session', async () => {
  const flow = await mountFlow(TYPED);

  await flow.unmount();

  expect(noteDraftDroppedByLock).toHaveBeenCalledTimes(1);
});

test('leaving the add flow with an empty draft reports nothing', async () => {
  const flow = await mountFlow(BLANK);

  await flow.unmount();

  expect(noteDraftDroppedByLock).not.toHaveBeenCalled();
});
