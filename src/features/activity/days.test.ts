import { BIOMETRIC } from '@/features/auth';
import type { ActivityEntry } from '@/models/activity';
import { DayKeySchema, InstantSchema } from '@/models/day';

import { buildActivityDays } from './days';

const TODAY = DayKeySchema.parse('2026-10-15');
const entry = (at: string, event: ActivityEntry['event']): ActivityEntry => ({
  id: at,
  at: InstantSchema.parse(at),
  event,
});

test('events group by Malaysia day, not UTC day', () => {
  const days = buildActivityDays(
    [
      entry('2026-10-14T16:30:00.000Z', { code: 'amounts.hidden' }),
      entry('2026-10-14T15:59:00.000Z', { code: 'amounts.revealed' }),
      entry('2026-10-13T00:20:00.000Z', { code: 'auth.unlocked' }),
    ],
    TODAY,
    BIOMETRIC.faceId,
  );

  expect(days.map((d) => d.heading)).toEqual([
    'TODAY · THU 15 OCT · 1 EVENT',
    'YESTERDAY · WED 14 OCT · 1 EVENT',
    'TUE 13 OCT · 1 EVENT',
  ]);
});

test('every event reads in plain words', () => {
  const [day] = buildActivityDays(
    [
      entry('2026-10-15T05:09:00.000Z', {
        code: 'settings.weakened',
        setting: 'relockAfter',
        minutes: 0,
      }),
      entry('2026-10-15T05:08:00.000Z', {
        code: 'settings.weakened',
        setting: 'idleLock',
        minutes: 10,
      }),
      entry('2026-10-15T05:07:00.000Z', { code: 'lock.locked', reason: 'background' }),
      entry('2026-10-15T05:06:00.000Z', { code: 'auth.failed', reason: 'lockout' }),
      entry('2026-10-15T05:05:00.000Z', { code: 'tx.undone', of: 'delete' }),
      entry('2026-10-15T05:04:00.000Z', { code: 'tx.erased', count: 3 }),
      entry('2026-10-15T05:03:00.000Z', { code: 'tx.erased', count: 1 }),
    ],
    TODAY,
    BIOMETRIC.fingerprint,
  );

  expect(day!.items.map((i) => [i.title, i.detail, i.time])).toEqual([
    ['Lock again after leaving changed to right away', null, '1:09 pm'],
    ['Lock when idle changed to 10 min', null, '1:08 pm'],
    ['Locked (left the app)', null, '1:07 pm'],
    ['Too many tries, locked out', null, '1:06 pm'],
    ['Undid a delete', null, '1:05 pm'],
    ['Erased 3 transactions you added', null, '1:04 pm'],
    ['Erased 1 transaction you added', null, '1:03 pm'],
  ]);
});
