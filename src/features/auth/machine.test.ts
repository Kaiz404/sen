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
  unlocked,
  stepUp: { status: 'stepUp', action: 'delete', returnTo: unlocked },
} as const satisfies Record<string, Session>;
type StateName = keyof typeof STATES;

const EVENTS = {
  'LAUNCHED vault': { type: 'LAUNCHED', hasVault: true },
  'LAUNCHED none': { type: 'LAUNCHED', hasVault: false },
  AUTH_START: { type: 'AUTH_START' },
  UNLOCK_OK: { type: 'UNLOCK_OK', at: 2_000, db: other },
  AUTH_FAIL: { type: 'AUTH_FAIL' },
  STEP_UP_START: { type: 'STEP_UP_START', action: 'reveal' },
  STEP_UP_DONE: { type: 'STEP_UP_DONE' },
  LOCK: { type: 'LOCK', reason: 'manual' },
  RESET: { type: 'RESET' },
} as const satisfies Record<string, SessionEvent>;
type EventName = keyof typeof EVENTS;

/** `same` means the reducer must return the very object it was given, so the store does not notify. */
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
    RESET: { status: 'welcome' },
  },
  setup: {
    UNLOCK_OK: { status: 'unlocked', since: 2_000, db: other },
    AUTH_FAIL: { status: 'welcome' },
  },
  unlocking: {
    UNLOCK_OK: { status: 'unlocked', since: 2_000, db: other },
    AUTH_FAIL: { status: 'locked', reason: 'idle' },
  },
  unlocked: {
    STEP_UP_START: { status: 'stepUp', action: 'reveal', returnTo: unlocked },
    LOCK: { status: 'locked', reason: 'manual' },
  },
  stepUp: {
    STEP_UP_DONE: { status: 'unlocked', since: 1_000, db },
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
  ['unlocked', 'unlocked'],
  ['stepUp', 'unlocked'],
] as const)('%s routes as %s', (stateName, gate) => {
  expect(gateOf(STATES[stateName])).toBe(gate);
});
