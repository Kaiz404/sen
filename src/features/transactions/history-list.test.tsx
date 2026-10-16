import '@shopify/flash-list/jestSetup';

import { render, screen } from '@testing-library/react-native';

import { BOARD_TODAY, manyRows } from './fixture-data';
import { NO_ACTIONS } from './fixtures';
import { HistoryView } from './history-view';
import { buildHistoryRows } from './rows';

test('10,000 rows mount fewer than 60 row components', async () => {
  const rows = buildHistoryRows(manyRows(10000), { today: BOARD_TODAY, complete: true });

  await render(
    <HistoryView
      today={BOARD_TODAY}
      body={{ kind: 'list', rows }}
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
    />,
  );

  const mounted = screen.getAllByTestId('tx-row').length;
  expect(rows.items.filter((item) => item.kind === 'tx')).toHaveLength(10001);
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(60);
});
