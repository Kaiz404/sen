import { act, render, screen, within } from '@testing-library/react-native';

import { MonthCard } from './parts';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const card = (hidden: boolean) => (
  <MonthCard
    flow="all"
    hidden={hidden}
    counts={undefined}
    asOf={null}
    biometric="fingerprint"
    onShow={() => {}}
    onHide={() => {}}
  />
);

test('the month card draws a still Sen on the first frame and the rig takes over after it', async () => {
  await render(card(true));

  expect(screen.getByLabelText('Sen, eyes closed while amounts are hidden')).toBeOnTheScreen();
  expect(screen.queryByTestId('sen-rig-month')).toBeNull();

  await act(() => jest.advanceTimersByTime(40));

  expect(screen.getByTestId('sen-rig-month')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sen, eyes closed while amounts are hidden')).toBeOnTheScreen();
});

test('amounts shown before the rig takes over still play Reveal on it', async () => {
  const view = await render(card(true));
  await view.rerender(card(false));
  await act(() => jest.advanceTimersByTime(40));
  expect(screen.getByTestId('sen-rig-month')).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(780));

  const lk = within(screen.getByTestId('sen-rig-month')).getByTestId('sen-lk');
  expect((lk.props.jestAnimatedProps.value.matrix as number[]).slice(4)).toEqual([18, -10]);
});
