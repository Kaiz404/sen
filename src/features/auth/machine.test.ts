import type { OpenDb } from '@/services/db';

import { gateOf, reduce, type Session, type SessionEvent } from './machine';

const db = { tag: 'db' } as unknown as OpenDb;
const other = { tag: 'other' } as unknown as OpenDb;

const unlocked: Session = { status: 'unlocked', since: 1_000, db };

const STATES = {
  launching: { status: 'launching' },
  welcome: { status: 'welcome' },
  locked: { status: 'locked', reason: 'idle' },
  setup: { status: 'authenticating', purpose: 'setup' },
  unlocking: { status: 'authenticating', purpose: 'unlock', reason: 'idle' },
  arriving: { status: 'arriving', purpose: 'unlock', since: 2_000, db },
  arrivingSetup: { status: 'arriving', purpose: 'setup', since: 2_000, db },
  unlocked,
  stepUp: { status: 'stepUp', action: 'delete', returnTo: unlocked },
  signingOut: { status: 'signingOut' },
} as const satisfies Record<string, Session>;
type StateName = keyof typeof STATES;

const EVENTS = {
  'LAUNCHED vault': { type: 'LAUNCHED', hasVault: true },
  'LAUNCHED none': { type: 'LAUNCHED', hasVault: false },
  AUTH_START: { type: 'AUTH_START' },
  UNLOCK_OK: { type: 'UNLOCK_OK', at: 2_000, db: other },
  ARRIVED: { type: 'ARRIVED' },
  AUTH_FAIL: { type: 'AUTH_FAIL' },
  STEP_UP_START: { type: 'STEP_UP_START', action: 'reveal' },
  STEP_UP_DONE: { type: 'STEP_UP_DONE' },
  LOCK: { type: 'LOCK', reason: 'manual' },
  SIGN_OUT_START: { type: 'SIGN_OUT_START' },
  SIGN_OUT_DONE: { type: 'SIGN_OUT_DONE' },
  SIGN_OUT_FAIL: { type: 'SIGN_OUT_FAIL' },
} as const satisfies Record<string, SessionEvent>;
type EventName = keyof typeof EVENTS;

const EXPECTED: Record<StateName, Partial<Record<EventName, Session>>> = {
  launching: {
    'LAUNCHED vault': { status: 'locked', reason: 'launch' },
    'LAUNCHED none': { status: 'welcome' },
  },
  welcome: {
    AUTH_START: { status: 'authenticating', purpose: 'setup' },
  },
  locked: {
    AUTH_START: { status: 'authenticating', purpose: 'unlock', reason: 'idle' },
    SIGN_OUT_START: { status: 'signingOut' },
  },
  setup: {
    UNLOCK_OK: { status: 'arriving', purpose: 'setup', since: 2_000, db: other },
    AUTH_FAIL: { status: 'welcome' },
  },
  unlocking: {
    UNLOCK_OK: { status: 'arriving', purpose: 'unlock', since: 2_000, db: other },
    AUTH_FAIL: { status: 'locked', reason: 'idle' },
  },
  arriving: {
    ARRIVED: { status: 'unlocked', since: 2_000, db },
    LOCK: { status: 'locked', reason: 'manual' },
  },
  arrivingSetup: {
    ARRIVED: { status: 'unlocked', since: 2_000, db },
    LOCK: { status: 'locked', reason: 'manual' },
  },
  unlocked: {
    STEP_UP_START: { status: 'stepUp', action: 'reveal', returnTo: unlocked },
    LOCK: { status: 'locked', reason: 'manual' },
    SIGN_OUT_START: { status: 'signingOut' },
  },
  stepUp: {
    LOCK: { status: 'stepUp', action: 'delete', returnTo: unlocked, lockPending: 'manual' },
    STEP_UP_DONE: { status: 'unlocked', since: 1_000, db },
  },
  signingOut: {
    SIGN_OUT_DONE: { status: 'welcome' },
    SIGN_OUT_FAIL: { status: 'locked', reason: 'signout' },
  },
};

const pairs = (Object.keys(STATES) as StateName[]).flatMap((state) =>
  (Object.keys(EVENTS) as EventName[]).map((event) => [state, event] as const),
);

test.each(pairs)('%s + %s', (stateName, eventName) => {
  const state = STATES[stateName];
  const next = reduce(state, EVENTS[eventName]);
  const expected = EXPECTED[stateName][eventName];

  if (expected === undefined) expect(next).toBe(state);
  else expect(next).toEqual(expected);
});

test.each([
  ['launching', 'locked'],
  ['welcome', 'welcome'],
  ['locked', 'locked'],
  ['setup', 'welcome'],
  ['unlocking', 'locked'],
  ['arriving', 'locked'],
  ['arrivingSetup', 'welcome'],
  ['unlocked', 'unlocked'],
  ['stepUp', 'unlocked'],
  ['signingOut', 'locked'],
] as const)('%s routes as %s', (stateName, gate) => {
  expect(gateOf(STATES[stateName])).toBe(gate);
});

test('a lock that arrives during a step-up applies when it ends, and the first one keeps its reason', () => {
  const held = reduce(
    reduce(STATES.stepUp, { type: 'LOCK', reason: 'background' }),
    { type: 'LOCK', reason: 'idle' },
  );

  expect(reduce(held, { type: 'STEP_UP_DONE' })).toEqual({ status: 'locked', reason: 'background' });
});
