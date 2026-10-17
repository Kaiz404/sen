import { ACTIVITY_LABEL_MAX, type ActivityEvent } from '@/models/activity';
import { InstantSchema } from '@/models/day';

import { clearActivity, createActivityRecorder, readActivity } from './activity-log';
import type { OpenDb } from './db';
import { openTestDb } from './db/testing/node-adapter';
import { logEvent } from './logger';

jest.mock('./logger');

let db: OpenDb;
let tick = 0;
const clock = () =>
  InstantSchema.parse(new Date(Date.UTC(2026, 9, 15, 5, 0, 0, tick++)).toISOString());

beforeEach(async () => {
  tick = 0;
  jest.clearAllMocks();
  db = await openTestDb();
});
afterEach(() => db.close());

const codes = async () => (await readActivity(db)).entries.map((e) => e.event.code);

test('events read back newest first, even when they share a millisecond', async () => {
  const log = createActivityRecorder(() => InstantSchema.parse('2026-10-15T05:00:00.000Z'));
  log.record(db, { code: 'auth.unlocked' });
  log.record(db, { code: 'amounts.revealed' });
  log.record(db, { code: 'amounts.hidden' });
  await log.settled();

  expect(await codes()).toEqual(['amounts.hidden', 'amounts.revealed', 'auth.unlocked']);
});

test('only the newest 50 events are kept', async () => {
  const log = createActivityRecorder(clock);
  for (let i = 0; i < 60; i++) log.record(db, { code: 'auth.failed', reason: 'mismatch' });
  log.record(db, { code: 'log.cleared' });
  await log.settled();

  const { entries } = await readActivity(db);
  expect(entries).toHaveLength(50);
  expect(entries[0]?.event.code).toBe('log.cleared');
});

test('an event with no open vault waits and is written, with its own time, at the next unlock', async () => {
  const log = createActivityRecorder(clock);
  log.record(null, { code: 'auth.failed', reason: 'mismatch' });
  log.record(null, { code: 'auth.failed', reason: 'lockout' });
  await log.settled();
  expect(await codes()).toEqual([]);

  log.flush(db);
  log.record(db, { code: 'auth.unlocked' });
  await log.settled();

  const { entries } = await readActivity(db);
  expect(entries.map((e) => e.event)).toEqual([
    { code: 'auth.unlocked' },
    { code: 'auth.failed', reason: 'lockout' },
    { code: 'auth.failed', reason: 'mismatch' },
  ]);
  expect(entries[2]!.at < entries[0]!.at).toBe(true);
});

test('waiting events are dropped when a sign-out discards them, and never past the log size', async () => {
  const log = createActivityRecorder(clock);
  for (let i = 0; i < 70; i++) log.record(null, { code: 'auth.failed', reason: 'mismatch' });
  log.flush(db);
  await log.settled();
  expect((await readActivity(db)).entries).toHaveLength(50);

  log.record(null, { code: 'auth.failed', reason: 'lockout' });
  log.discard();
  log.flush(db);
  await log.settled();
  expect((await readActivity(db)).entries.every((e) => e.event.code === 'auth.failed')).toBe(true);
  expect(
    (await readActivity(db)).entries.some(
      (e) => 'reason' in e.event && e.event.reason === 'lockout',
    ),
  ).toBe(false);
});

test('an amount forced into an event never reaches the table', async () => {
  const log = createActivityRecorder(clock);
  const forced = {
    code: 'tx.added',
    label: 'Lunch',
    amountMinor: 4250,
  } as unknown as ActivityEvent;
  log.record(db, forced);
  log.record(db, { code: 'tx.added', label: 'Lunch' });
  await log.settled();

  const raw = await db.all('SELECT code, meta FROM activity_log');
  expect(raw).toEqual([{ code: 'tx.added', meta: '{"label":"Lunch"}' }]);
  expect(logEvent).toHaveBeenCalledWith('activity.write_failed');
});

test('a description longer than a label may be is cut, and the event is still kept', async () => {
  const log = createActivityRecorder(clock);
  log.record(db, { code: 'tx.deleted', label: 'x'.repeat(ACTIVITY_LABEL_MAX + 40) });
  await log.settled();

  expect((await readActivity(db)).entries.map((e) => e.event)).toEqual([
    { code: 'tx.deleted', label: 'x'.repeat(ACTIVITY_LABEL_MAX) },
  ]);
});

test('held events are written together, so a bad one keeps all of them out', async () => {
  const log = createActivityRecorder(clock);
  log.record(null, { code: 'auth.failed', reason: 'mismatch' });
  log.record(null, { code: 'nope' } as unknown as ActivityEvent);
  log.flush(db);
  await log.settled();

  expect(await codes()).toEqual([]);
  expect(logEvent).toHaveBeenCalledWith('activity.write_failed');
});

test('a failed write is counted and never thrown to the caller', async () => {
  const log = createActivityRecorder(clock);
  await db.close();
  expect(() => log.record(db, { code: 'auth.unlocked' })).not.toThrow();
  await expect(log.settled()).resolves.toBeUndefined();
  expect(logEvent).toHaveBeenCalledWith('activity.write_failed');
  db = await openTestDb();
});

test('a row that no longer parses is skipped and counted', async () => {
  await db.run(
    "INSERT INTO activity_log (id, at, code, meta) VALUES ('a', '2026-10-15T05:00:00.000Z', 'tx.edited', '{}')",
  );
  await db.run(
    "INSERT INTO activity_log (id, at, code, meta) VALUES ('b', '2026-10-15T05:00:01.000Z', 'auth.unlocked', '{}')",
  );

  const read = await readActivity(db);
  expect(read.entries.map((e) => e.event.code)).toEqual(['auth.unlocked']);
  expect(read.skipped).toBe(1);
});

test('clearing leaves exactly one entry that says so', async () => {
  const log = createActivityRecorder(clock);
  log.record(db, { code: 'auth.unlocked' });
  log.record(db, { code: 'amounts.revealed' });
  await log.settled();

  await clearActivity(db, InstantSchema.parse('2026-10-15T06:00:00.000Z'));

  expect(await codes()).toEqual(['log.cleared']);
});
