import { afterUnlock, canReset, IDLE, KEY_RESET_SPAN_MS, type PromptView } from './prompt-view';

type StoreView = Extract<PromptView, { kind: 'store' }>;

function failOpens(cause: 'key' | 'store', ...times: number[]): StoreView {
  let view: PromptView = IDLE;
  for (const at of times) view = afterUnlock(view, { ok: false, reason: 'store', cause }, at);
  return view as StoreView;
}

describe('when Lock offers to reset the store', () => {
  test('two quick key failures do not, because a busy keystore clears by itself', () => {
    expect(canReset(failOpens('key', 1_000, 3_000))).toBe(false);
  });

  test('key failures a half minute apart do', () => {
    expect(canReset(failOpens('key', 1_000, 1_000 + KEY_RESET_SPAN_MS))).toBe(true);
  });

  test('two quick failures of the store itself do', () => {
    expect(canReset(failOpens('store', 1_000, 3_000))).toBe(true);
  });

  test('one failure does not', () => {
    expect(canReset(failOpens('store', 1_000))).toBe(false);
  });
});
