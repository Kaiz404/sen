import { InstantSchema } from '@/models/day';

import { BOARD_ROWS, BOARD_TODAY } from './fixture-data';
import { buildHistoryRows, clockText, monthName, monthSoFar, toRowView } from './rows';

const shape = (items: ReturnType<typeof buildHistoryRows>['items']) =>
  items.map((item) =>
    item.kind === 'day'
      ? `${item.title}|${item.caption}`
      : item.kind === 'tx'
        ? `${item.first ? '*' : ' '}${item.row.title}`
        : `net ${item.day}`,
  );

test('the boards rows become day tops, rows and nets, with every day top sticky', () => {
  const { items, sticky } = buildHistoryRows(BOARD_ROWS.slice(0, 10), {
    today: BOARD_TODAY,
    complete: true,
  });

  expect(shape(items)).toEqual([
    'Today|THU 15 OCT',
    '*Lunch with Hafiz, cash',
    ' Tealive',
    ' DuitNow from Aisyah Rahman',
    ' Grab ride to KL Sentral',
    'net 2026-10-15',
    'Yesterday|WED 14 OCT',
    '*TNB electricity',
    ' Shopee',
    " Touch 'n Go eWallet reload",
    'net 2026-10-14',
    'Tue 13 Oct|PAYDAY',
    '*GrabFood',
    ' Salary · [EMPLOYER]',
    'net 2026-10-13',
    'Mon 12 Oct|',
    '*' + BOARD_ROWS[9]!.description,
    'net 2026-10-12',
  ]);
  expect(sticky).toEqual([0, 6, 11, 15]);
});

test("the last day stays open while a page is left, because its other rows aren't loaded yet", () => {
  const rows = BOARD_ROWS.slice(0, 3);

  expect(shape(buildHistoryRows(rows, { today: BOARD_TODAY, complete: false }).items)).toEqual([
    'Today|THU 15 OCT',
    '*Lunch with Hafiz, cash',
    ' Tealive',
    ' DuitNow from Aisyah Rahman',
  ]);
});

test('a row view shows a tag in place of its category, and has no amount', () => {
  const [lunch, tealive, duitnow] = BOARD_ROWS;

  expect(toRowView(lunch!)).toEqual({
    id: 'm-board-lunch',
    postedAt: '2026-10-15T05:42:00.000Z',
    title: 'Lunch with Hafiz, cash',
    time: '1:42 pm',
    detail: null,
    tag: 'added',
    direction: 'debit',
    icon: 'food',
    tone: 0,
    shape: expect.any(Number),
  });
  expect(toRowView(tealive!)).toMatchObject({ tag: 'pending', detail: null, time: '1:15 pm' });
  expect(toRowView(duitnow!)).toMatchObject({
    tag: null,
    detail: 'Transfer in',
    icon: 'bank-transfer-in',
    time: '11:02 am',
  });
});

test('a row object keeps its view, so an unchanged row skips its render', () => {
  const firstView = (complete: boolean) => {
    const item = buildHistoryRows(BOARD_ROWS, { today: BOARD_TODAY, complete }).items[1];
    if (item?.kind !== 'tx') throw new Error('the second item is a row');
    return item.row;
  };

  expect(firstView(false)).toBe(firstView(true));
});

test('times and month copy read in Malaysia time', () => {
  expect(clockText(InstantSchema.parse('2026-10-14T16:05:00.000Z'))).toBe('12:05 am');
  expect(clockText(InstantSchema.parse('2026-10-15T04:00:00.000Z'))).toBe('12:00 pm');
  expect(monthName(BOARD_TODAY)).toBe('October');
  expect(monthSoFar(BOARD_TODAY)).toBe('so far, 1 to 15 Oct');
});
