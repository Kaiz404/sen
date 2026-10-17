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
  const mismatch: PromptView = { kind: 'mismatch' };

  expect(afterRecheck(error, 'none')).toEqual({ kind: 'noLock' });
  expect(afterRecheck(mismatch, 'none')).toEqual({ kind: 'noLock' });
  expect(afterRecheck(mismatch, 'strong')).toEqual(mismatch);
});

describe('a timed-out prompt', () => {
  const timedOut = (view: PromptView, at = 1_000) =>
    afterUnlock(view, { ok: false, reason: 'timedOut' }, at);
  const mismatch = (view: PromptView, at = 0) =>
    afterUnlock(view, { ok: false, reason: 'mismatch' }, at);
  const lockout = (view: PromptView, at: number) =>
    afterUnlock(view, { ok: false, reason: 'lockout' }, at);

  test('says so from idle or after a mismatch', () => {
    expect(timedOut(IDLE).kind).toBe('timedOut');
    expect(timedOut(mismatch(IDLE)).kind).toBe('timedOut');
  });

  test('a miss after a timeout is still a miss, and no count of tries is kept', () => {
    expect(mismatch(timedOut(mismatch(IDLE)))).toEqual({ kind: 'mismatch' });
    expect(mismatch(timedOut(IDLE))).toEqual({ kind: 'mismatch' });
  });

  test('keeps the off and weak setup views, which still have their own keys', () => {
    const off: PromptView = { kind: 'off', canOpenSettings: true };
    const weak: PromptView = { kind: 'weak' };
    expect(timedOut(off)).toEqual({ kind: 'timedOut', over: off });
    expect(timedOut(weak)).toEqual({ kind: 'timedOut', over: weak });
  });

  test('leaves a running lockout, a block or a store failure as it was', () => {
    const view: PromptView = { kind: 'lockout', until: 5_000 };
    const blocked: PromptView = { kind: 'blocked', since: 0 };
    expect(timedOut(view)).toBe(view);
    expect(timedOut(blocked)).toBe(blocked);
  });

  test('after a lockout has ended says so, and a lockout then still escalates to the block', () => {
    const ended: PromptView = { kind: 'lockout', until: 1_000 };
    const view = timedOut(ended, 40_000);
    expect(view.kind).toBe('timedOut');
    expect(lockout(view, 41_000)).toEqual({ kind: 'blocked', since: 41_000 });
  });
});
