import '@shopify/flash-list/jestSetup';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { toast, ToastHost } from '@/components/toast';

import { BOARD_ROWS, BOARD_TODAY, manyRows } from './fixture-data';
import { NO_ACTIONS } from './fixtures';
import { HistoryView, type HistoryViewProps } from './history-view';
import { buildHistoryRows, NO_ARRIVAL } from './rows';

jest.mock('@/components/enter-once', () => {
  const { createElement } = jest.requireActual('react');
  const { View: MockView } = jest.requireActual('react-native');
  return {
    EnterOnce: ({ children }: { children: ReactNode }) =>
      createElement(MockView, { testID: 'enter-once' }, children),
  };
});

function List(props: Partial<HistoryViewProps>) {
  return (
    <HistoryView
      today={BOARD_TODAY}
      body={{
        kind: 'list',
        rows: buildHistoryRows(BOARD_ROWS, { today: BOARD_TODAY, complete: true }),
      }}
      hidden
      search=""
      flow="all"
      monthCounts={undefined}
      resultCounts={undefined}
      banner={null}
      skipped={0}
      skippedNotice={null}
      notice={null}
      pull="idle"
      arrival={NO_ARRIVAL}
      updated={null}
      biometric="fingerprint"
      revealed={null}
      actions={NO_ACTIONS}
      {...props}
    />
  );
}

test('10,000 rows mount fewer than 60 row components', async () => {
  const rows = buildHistoryRows(manyRows(10000), { today: BOARD_TODAY, complete: true });

  await render(<List body={{ kind: 'list', rows }} />);

  const mounted = screen.getAllByTestId('tx-row').length;
  expect(rows.items.filter((item) => item.kind === 'tx')).toHaveLength(10001);
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(60);
});

test('only a row newer than the last refresh slides in, and none slides once the arrival clears', async () => {
  const [newest, before] = BOARD_ROWS;

  await render(
    <List arrival={{ after: { postedAt: before!.postedAt, id: before!.id }, added: null }} />,
  );

  expect(screen.getAllByTestId('enter-once')).toHaveLength(1);
  expect(within(screen.getByTestId('enter-once')).getByText(newest!.description)).toBeOnTheScreen();

  await screen.rerender(<List arrival={NO_ARRIVAL} />);

  expect(screen.queryAllByTestId('enter-once')).toHaveLength(0);
  expect(screen.getByText(newest!.description)).toBeOnTheScreen();
});

test('a row the user just added slides in wherever it sorts, and no other row does', async () => {
  const added = BOARD_ROWS[2]!;

  await render(<List arrival={{ after: null, added: added.id }} />);

  expect(screen.getAllByTestId('enter-once')).toHaveLength(1);
  expect(within(screen.getByTestId('enter-once')).getByText(added.description)).toBeOnTheScreen();
});

const layout = (id: string, y: number, height: number) =>
  fireEvent(screen.getByTestId(id), 'layout', {
    nativeEvent: { layout: { x: 0, y, width: 300, height } },
  });

test('the skipped-rows notice sits in the flow above the list, never over the month title', async () => {
  await render(<List skippedNotice={2} />);

  const notice = screen.getByTestId('skipped-notice');
  expect(notice).not.toHaveStyle({ position: 'absolute' });
  expect(within(screen.getByTestId('history-list')).queryByTestId('skipped-notice')).toBeNull();
  expect(
    screen.getByText("2 items couldn't be read and were skipped. The rest is fine."),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Got it' })).toBeOnTheScreen();
});

test('the Add key steps aside while a toast lifts it over the filter row, and returns when the toast goes', async () => {
  jest.useFakeTimers();
  await render(
    <>
      <List />
      <ToastHost />
    </>,
  );
  // The key rests at 620 to 684 in the slot, and 528 to 592 once a toast lifts it.
  await act(async () => {
    layout('add-key', 620, 64);
    layout('history-filters', 600, 50);
  });
  expect(screen.getByTestId('add-key', { includeHiddenElements: true })).toHaveStyle({
    opacity: 0,
  });

  await act(async () => {
    layout('history-filters', 400, 50);
  });
  expect(screen.getByTestId('add-key', { includeHiddenElements: true })).toHaveStyle({
    opacity: 1,
  });

  await act(async () => toast.show({ title: 'Added' }));
  expect(screen.getByTestId('add-key', { includeHiddenElements: true })).toHaveStyle({
    opacity: 1,
  });
  await act(async () => layout('history-filters', 560, 50));
  expect(screen.getByTestId('add-key', { includeHiddenElements: true })).toHaveStyle({
    opacity: 0,
  });

  await act(async () => toast.hide());
  expect(screen.getByTestId('add-key', { includeHiddenElements: true })).toHaveStyle({
    opacity: 1,
  });
  jest.useRealTimers();
});
