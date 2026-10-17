import type { ReactNode } from 'react';

import { BIOMETRIC } from '@/features/auth';
import type { ActivityEntry, ActivityEvent } from '@/models/activity';
import { DayKeySchema, type Instant, InstantSchema } from '@/models/day';

import { ActivityView, type ActivityViewProps, type ClearState } from './activity-screen';
import { buildActivityDays } from './days';

const noop = () => {};
const SENSOR = BIOMETRIC.fingerprint;
const TODAY = DayKeySchema.parse('2026-10-15');
const at = (text: string): Instant => InstantSchema.parse(text);

type Spec = readonly [string, ActivityEvent];

/** The board's three days. Times are Malaysia time (UTC+8), written here in UTC. */
const SPECS: readonly Spec[] = [
  ['2026-10-15T06:04:00.000Z', { code: 'settings.weakened', setting: 'idleLock', minutes: 10 }],
  ['2026-10-15T05:58:00.000Z', { code: 'tx.deleted', label: 'Parking, Pavilion KL' }],
  ['2026-10-15T05:50:00.000Z', { code: 'tx.undone', of: 'add', label: 'Teh tarik' }],
  ['2026-10-15T05:42:00.000Z', { code: 'tx.added', label: 'Lunch with Hafiz, cash' }],
  ['2026-10-15T05:31:00.000Z', { code: 'amounts.hidden' }],
  ['2026-10-15T05:30:00.000Z', { code: 'amounts.revealed' }],
  ['2026-10-15T05:29:30.000Z', { code: 'auth.unlocked' }],
  ['2026-10-15T05:29:00.000Z', { code: 'auth.failed', reason: 'mismatch' }],
  ['2026-10-14T14:12:00.000Z', { code: 'lock.locked', reason: 'idle' }],
  ['2026-10-14T13:58:00.000Z', { code: 'tx.added', label: 'Parking, Pavilion KL' }],
  ['2026-10-14T13:51:00.000Z', { code: 'amounts.hidden' }],
  ['2026-10-14T13:50:00.000Z', { code: 'amounts.revealed' }],
  ['2026-10-14T13:50:00.000Z', { code: 'auth.unlocked' }],
  ['2026-10-13T00:20:00.000Z', { code: 'auth.unlocked' }],
  ['2026-10-13T00:14:00.000Z', { code: 'demo.reset' }],
];

const ENTRIES: readonly ActivityEntry[] = SPECS.map(([time, event], i) => ({
  id: `fixture-${i}`,
  at: at(time),
  event,
}));

const READY = {
  kind: 'ready',
  kept: ENTRIES.length,
  days: buildActivityDays(ENTRIES, TODAY, SENSOR),
} as const;

const IDLE: ClearState = { kind: 'idle' };

const BASE: ActivityViewProps = {
  body: READY,
  sensor: SENSOR,
  clear: IDLE,
  onBack: noop,
  onRetry: noop,
  onClear: noop,
};

export const ACTIVITY_STATES = {
  list: () => <ActivityView {...BASE} />,
  empty: () => <ActivityView {...BASE} body={{ kind: 'ready', kept: 0, days: [] }} />,
  loading: () => <ActivityView {...BASE} body={{ kind: 'loading' }} />,
  failed: () => <ActivityView {...BASE} body={{ kind: 'failed' }} />,
  clearing: () => <ActivityView {...BASE} clear={{ kind: 'clearing' }} />,
  'clear-refused': () => <ActivityView {...BASE} clear={{ kind: 'refused', reason: 'timedOut' }} />,
  'clear-failed': () => <ActivityView {...BASE} clear={{ kind: 'failed' }} />,
} satisfies Readonly<Record<string, () => ReactNode>>;
