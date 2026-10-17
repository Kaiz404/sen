import {
  type ActivityCode,
  type ActivityEntry,
  type ActivityEvent,
  ActivityEventSchema,
  ACTIVITY_CAP,
  ACTIVITY_LABEL_MAX,
} from '@/models/activity';
import { type Instant, toInstant } from '@/models/day';

import type { Db } from './db';
import { logEvent, type LogCode } from './logger';

/** Every activity code is also a logger code, so the console and the log name an event alike. */
type CodesAreLogged = ActivityCode extends LogCode ? true : never;
export const codesAreLogged: CodesAreLogged = true;

type Stamped = { readonly id: string; readonly at: Instant; readonly event: ActivityEvent };

/** A description longer than a label may be is cut, so a long one never costs the whole event. */
function fitLabel(event: ActivityEvent): ActivityEvent {
  return 'label' in event && event.label !== undefined
    ? { ...event, label: event.label.slice(0, ACTIVITY_LABEL_MAX) }
    : event;
}

async function insert(db: Db, entry: Stamped): Promise<void> {
  const { code, ...meta } = ActivityEventSchema.parse(fitLabel(entry.event));
  await db.run('INSERT INTO activity_log (id, at, code, meta) VALUES (?, ?, ?, ?)', [
    entry.id,
    entry.at,
    code,
    JSON.stringify(meta),
  ]);
}

function parseEntry(row: Readonly<Record<string, unknown>>): ActivityEntry | null {
  try {
    const event = ActivityEventSchema.safeParse({
      code: row.code,
      ...JSON.parse(String(row.meta)),
    });
    if (!event.success || typeof row.id !== 'string' || typeof row.at !== 'string') return null;
    return { id: row.id, at: row.at as Instant, event: event.data };
  } catch {
    return null;
  }
}

export type ActivityRead = { readonly entries: readonly ActivityEntry[]; readonly skipped: number };

/** The kept events, newest first. A row that no longer parses is skipped and counted. */
export async function readActivity(db: Db): Promise<ActivityRead> {
  const rows = await db.all(
    `SELECT id, at, code, meta FROM activity_log ORDER BY at DESC, id DESC LIMIT ${ACTIVITY_CAP}`,
  );
  const entries: ActivityEntry[] = [];
  for (const row of rows) {
    const entry = parseEntry(row);
    if (entry !== null) entries.push(entry);
  }
  return { entries, skipped: rows.length - entries.length };
}

/** Empties the log and leaves the one entry that says so. */
export async function clearActivity(db: Db, at: Instant = toInstant(new Date())): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM activity_log');
    await insert(tx, { id: `${at}#clear`, at, event: { code: 'log.cleared' } });
  });
}

/**
 * Writes events as they happen. With no open database (a failed unlock, before the vault opens) an event waits in
 * memory, up to the log's size, and `flush` writes it at the next unlock with its own time. A failed write is
 * counted by the logger and never reaches the flow that caused the event.
 */
export function createActivityRecorder(clock: () => Instant = () => toInstant(new Date())) {
  const waiting: Stamped[] = [];
  const inflight = new Set<Promise<void>>();
  let sequence = 0;

  function track(work: Promise<void>): void {
    const job: Promise<void> = work
      .catch(() => logEvent('activity.write_failed'))
      .finally(() => inflight.delete(job));
    inflight.add(job);
  }

  function write(db: Db, entry: Stamped): void {
    logEvent(entry.event.code);
    track(insert(db, entry));
  }

  return {
    record(db: Db | null, event: ActivityEvent): void {
      const at = clock();
      sequence += 1;
      const entry = { id: `${at}#${String(sequence).padStart(6, '0')}`, at, event };
      if (db !== null) return write(db, entry);
      waiting.push(entry);
      if (waiting.length > ACTIVITY_CAP) waiting.shift();
    },
    /** Writes the held events in one transaction, so a failure keeps none of them half-written. */
    flush(db: Db): void {
      const held = waiting.splice(0);
      if (held.length === 0) return;
      for (const entry of held) logEvent(entry.event.code);
      track(
        (async () => {
          await db.transaction(async (tx) => {
            for (const entry of held) await insert(tx, entry);
          });
        })(),
      );
    },
    /**
     * For tests: resolves once every write started so far has finished. The app doesn't wait on it. A lock closes
     * the database through the same first-in, first-out queue the writes joined, so the close runs after them.
     */
    settled: async (): Promise<void> => {
      await Promise.all([...inflight]);
    },
    discard(): void {
      waiting.length = 0;
    },
  };
}

export const activity = createActivityRecorder();
