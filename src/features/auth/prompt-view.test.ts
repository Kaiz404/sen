import {
  afterRecheck,
  afterUnlock,
  initialView,
  canReset,
  IDLE,
  KEY_RESET_SPAN_MS,
  type PromptView,
} from './prompt-view';

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

describe('the view after a prompt', () => {
  const after = (view: PromptView, reason: 'cancelled' | 'timedOut' | 'noLock' | 'unavailable' | 'unknown') =>
    afterUnlock(view, { ok: false, reason }, 0);

  test('a cancel changes nothing', () => {
    expect(after(IDLE, 'cancelled')).toBe(IDLE);
  });

  test('a timeout says so and leaves the key ready, and a store failure outranks it', () => {
    expect(after(IDLE, 'timedOut')).toEqual({ kind: 'timedOut' });
    const store = failOpens('store', 1_000);
    expect(after(store, 'timedOut')).toBe(store);
  });

  test('an error or an unavailable check shows the retry view', () => {
    expect(after(IDLE, 'unknown')).toEqual({ kind: 'error' });
    expect(after(IDLE, 'unavailable')).toEqual({ kind: 'error' });
  });

  test('a phone with no screen lock shows the D28 view', () => {
    expect(after(IDLE, 'noLock')).toEqual({ kind: 'noLock' });
  });

  test('an unlock that goes through clears any view', () => {
    expect(afterUnlock({ kind: 'error' }, { ok: true }, 0)).toEqual(IDLE);
  });
});

describe('what the phone has set up', () => {
  test('every level but none opens on the one key', () => {
    expect(initialView('strong')).toEqual(IDLE);
    expect(initialView('weak')).toEqual(IDLE);
    expect(initialView('passcode')).toEqual(IDLE);
    expect(initialView('none')).toEqual({ kind: 'noLock' });
  });

  test('a phone that loses its screen lock shows the no-lock view over any earlier attempt', () => {
    const error: PromptView = { kind: 'error' };

    expect(afterRecheck(error, 'none')).toEqual({ kind: 'noLock' });
    expect(afterRecheck(failOpens('store', 1), 'none')).toEqual({ kind: 'noLock' });
    expect(afterRecheck(error, 'strong')).toEqual(error);
  });

  test('coming back to the front clears a timeout and a no-lock view that no longer holds', () => {
    expect(afterRecheck({ kind: 'timedOut' }, 'strong')).toEqual(IDLE);
    expect(afterRecheck({ kind: 'noLock' }, 'passcode')).toEqual(IDLE);
  });
});
