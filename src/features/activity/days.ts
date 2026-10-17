import type { IconName } from '@/components/key';
import { type BiometricCopy } from '@/features/auth';
import type { ActivityCode, ActivityEntry, ActivityEvent } from '@/models/activity';
import { addDays, type DayKey, type Instant, malaysiaDay } from '@/models/day';

/** A glyph tint: an index into the six pastels, or the plain chip for events that only happen to the app. */
export type Tint = number | 'plain';

type Words = {
  readonly title: string;
  readonly detail?: string;
  readonly icon: IconName;
  readonly tint: Tint;
};

type Describe = {
  readonly [C in ActivityCode]: (
    event: Extract<ActivityEvent, { code: C }>,
    sensor: BiometricCopy,
  ) => Words;
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const quoted = (label: string | undefined) => (label === undefined ? undefined : `“${label}”`);

function minutes(n: number): string {
  return n === 0 ? 'right away' : `${n} min`;
}

const LOCK_WHY = { idle: 'idle', background: 'left the app', manual: 'by you' } as const;

/** The words, glyph and tint for each event. A new code fails the type until it has a line here. */
const DESCRIBE: Describe = {
  'auth.unlocked': (_, sensor) => ({
    title: `Unlocked with ${sensor.name}`,
    icon: sensor.icon,
    tint: 1,
  }),
  'auth.failed': (e, sensor) => ({
    title:
      e.reason === 'mismatch'
        ? `${capital(sensor.name)} didn’t match`
        : 'Too many tries, locked out',
    icon: sensor.icon,
    tint: 0,
  }),
  'lock.locked': (e) => ({
    title: `Locked (${LOCK_WHY[e.reason]})`,
    icon: 'lock-outline',
    tint: 'plain',
  }),
  'amounts.revealed': () => ({ title: 'Revealed amounts', icon: 'eye-outline', tint: 3 }),
  'amounts.hidden': () => ({ title: 'Amounts hidden', icon: 'eye-off-outline', tint: 'plain' }),
  'tx.added': (e) => ({
    title: 'Added a transaction',
    detail: quoted(e.label),
    icon: 'plus',
    tint: 2,
  }),
  'tx.deleted': (e) => ({
    title: 'Deleted a transaction',
    detail: quoted(e.label),
    icon: 'trash-can-outline',
    tint: 4,
  }),
  'tx.erased': (e) => ({
    title: `Erased ${e.count} ${e.count === 1 ? 'transaction' : 'transactions'} you added`,
    icon: 'delete-forever-outline',
    tint: 4,
  }),
  'tx.undone': (e) => ({
    title: e.of === 'add' ? 'Undid an add' : 'Undid a delete',
    detail: quoted(e.label),
    icon: 'undo',
    tint: 'plain',
  }),
  'settings.weakened': (e) => ({
    title:
      e.setting === 'idleLock'
        ? `Lock when idle changed to ${minutes(e.minutes)}`
        : `Lock again after leaving changed to ${minutes(e.minutes)}`,
    icon: 'clock-outline',
    tint: 5,
  }),
  'demo.reset': () => ({ title: 'Reset demo data', icon: 'refresh', tint: 4 }),
  'log.cleared': () => ({ title: 'Log cleared', icon: 'delete-sweep-outline', tint: 'plain' }),
};

export type ActivityItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string | null;
  readonly icon: IconName;
  readonly tint: Tint;
  readonly time: string;
  readonly at: Instant;
};

export type ActivityDay = {
  readonly key: DayKey;
  readonly heading: string;
  readonly items: readonly ActivityItem[];
};

const HOUR_MS = 3_600_000;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Malaysia time of day, such as "1:42 pm". */
export function clockText(at: Instant): string {
  const local = new Date(Date.parse(at) + 8 * HOUR_MS);
  const h = local.getUTCHours();
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

function headingFor(day: DayKey, today: DayKey, count: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const full = `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  const near = day === today ? 'TODAY' : day === addDays(today, -1) ? 'YESTERDAY' : null;
  return `${near === null ? full : `${near} · ${full}`} · ${count} ${count === 1 ? 'EVENT' : 'EVENTS'}`;
}

export function describe(entry: ActivityEntry, sensor: BiometricCopy): ActivityItem {
  const words = (DESCRIBE[entry.event.code] as (e: ActivityEvent, s: BiometricCopy) => Words)(
    entry.event,
    sensor,
  );
  return {
    id: entry.id,
    title: words.title,
    detail: words.detail ?? null,
    icon: words.icon,
    tint: words.tint,
    time: clockText(entry.at),
    at: entry.at,
  };
}

/** The log as day slips, newest first, grouped by Malaysia day. `entries` arrive newest first. */
export function buildActivityDays(
  entries: readonly ActivityEntry[],
  today: DayKey,
  sensor: BiometricCopy,
): ActivityDay[] {
  const groups = new Map<DayKey, ActivityItem[]>();
  for (const entry of entries) {
    const day = malaysiaDay(entry.at);
    const items = groups.get(day) ?? [];
    items.push(describe(entry, sensor));
    groups.set(day, items);
  }
  return [...groups].map(([key, items]) => ({
    key,
    heading: headingFor(key, today, items.length),
    items,
  }));
}
