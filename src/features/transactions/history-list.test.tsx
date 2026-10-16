import '@shopify/flash-list/jestSetup';

import { render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { BOARD_ROWS, BOARD_TODAY, manyRows } from './fixture-data';
import { NO_ACTIONS } from './fixtures';
import { HistoryView, type HistoryViewProps } from './history-view';
import { buildHistoryRows } from './rows';

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
      notice={null}
      refreshing={false}
      arrival={null}
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

  await render(<List arrival={{ postedAt: before!.postedAt, id: before!.id }} />);

  expect(screen.getAllByTestId('enter-once')).toHaveLength(1);
  expect(within(screen.getByTestId('enter-once')).getByText(newest!.description)).toBeOnTheScreen();

  await screen.rerender(<List arrival={null} />);

  expect(screen.queryAllByTestId('enter-once')).toHaveLength(0);
  expect(screen.getByText(newest!.description)).toBeOnTheScreen();
});
