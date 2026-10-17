import {
  afterRecheck,
  afterUnlock,
  BLOCKED_FOR_MS,
  canReset,
  IDLE,
  KEY_RESET_SPAN_MS,
  LOCKOUT_MS,
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

describe('repeated lockouts', () => {
  const lockedOut = (view: PromptView, at: number) =>
    afterUnlock(view, { ok: false, reason: 'lockout' }, at);

  test('a second lockout steers to the passcode and promises no countdown', () => {
    const second = lockedOut(lockedOut(IDLE, 1_000), 40_000);

    expect(second).toEqual({ kind: 'blocked', since: 40_000 });
    expect(lockedOut(second, 50_000)).toEqual(second);
  });

  test('the steer lifts after a cool-down, so the fingerprint is trusted with a first lockout again', () => {
    const blocked: PromptView = { kind: 'blocked', since: 40_000 };

    expect(lockedOut(blocked, 40_000 + BLOCKED_FOR_MS)).toEqual({
      kind: 'lockout',
      until: 40_000 + BLOCKED_FOR_MS + LOCKOUT_MS,
    });
  });

  test('an unlock that goes through clears it', () => {
    expect(afterUnlock({ kind: 'blocked', since: 1 }, { ok: true }, 2)).toEqual(IDLE);
  });
});

test('a phone that loses its screen lock shows the no-lock view over any earlier attempt', () => {
  const error: PromptView = { kind: 'error' };
  const mismatch: PromptView = { kind: 'mismatch', triesLeft: 1 };

  expect(afterRecheck(error, 'none')).toEqual({ kind: 'noLock' });
  expect(afterRecheck(mismatch, 'none')).toEqual({ kind: 'noLock' });
  expect(afterRecheck(mismatch, 'strong')).toEqual(mismatch);
});

describe('a timed-out prompt', () => {
  const timedOut = (view: PromptView) => afterUnlock(view, { ok: false, reason: 'timedOut' }, 1_000);

  test('says so and offers the key, from idle or after a mismatch', () => {
    expect(timedOut(IDLE)).toEqual({ kind: 'timedOut' });
    expect(timedOut({ kind: 'mismatch', triesLeft: 1 })).toEqual({ kind: 'timedOut' });
  });

  test('is not a try, a lockout, a block or a store failure', () => {
    const once = afterUnlock(IDLE, { ok: false, reason: 'mismatch' }, 0);
    expect(timedOut(timedOut(once))).toEqual({ kind: 'timedOut' });
    expect(afterUnlock(timedOut(IDLE), { ok: false, reason: 'mismatch' }, 2_000)).toEqual({
      kind: 'mismatch',
      triesLeft: 2,
    });
  });

  test('leaves a lockout or a block as it was', () => {
    const blocked: PromptView = { kind: 'blocked', since: 0 };
    expect(timedOut(blocked)).toBe(blocked);
  });
});
