import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { Minor } from '@/models/money';

import { MonthCard } from './parts';
import { type Revealed, RevealedAmounts } from './reveal';

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

const totals = (inMinor: number, outMinor: number): Revealed => ({
  amounts: new Map(),
  month: {
    in: { count: 1, minor: inMinor as Minor },
    out: { count: 1, minor: outMinor as Minor },
  },
});

function shown(value: Revealed | null, hidden: boolean) {
  return (
    <RevealedAmounts value={value}>
      <MonthCard
        flow="all"
        hidden={hidden}
        counts={undefined}
        asOf={null}
        biometric="fingerprint"
        onShow={() => {}}
        onHide={() => {}}
      />
    </RevealedAmounts>
  );
}

const heights = () =>
  ['hero-slot', 'money-in'].map((id) => StyleSheet.flatten(screen.getByTestId(id).props.style).height);

const LAYOUT = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 96 } } });

test.each([
  ['no amount yet', undefined],
  ['zero', totals(0, 0)],
  ['an ordinary month', totals(120000, 98765)],
  ['the longest amount', totals(99999999999, 99999999999)],
])('the month card rows have the same fixed heights hidden and shown: %s', async (_name, value) => {
  const view = await render(shown(null, true));
  const hidden = heights();
  expect(hidden).toEqual([96, 58]);

  await view.rerender(shown(value ?? null, false));
  if (value !== undefined) {
    // A wide hero scales down inside its slot; the slot itself never moves.
    // The hero is the first fit box, the Money in amount the second.
    await fireEvent(screen.getAllByTestId('fit-box')[0]!, 'layout', LAYOUT(300));
    await fireEvent(screen.getAllByTestId('fit-content')[0]!, 'layout', LAYOUT(900));
    await fireEvent(screen.getAllByTestId('fit-box')[1]!, 'layout', LAYOUT(120));
    await fireEvent(screen.getAllByTestId('fit-content')[1]!, 'layout', LAYOUT(240));
  }

  expect(heights()).toEqual(hidden);
  expect(screen.queryByText(/Asks for/)).toBeNull();
});

test('the Show and Hide keys are the same size', async () => {
  const view = await render(shown(null, true));
  const key = () => StyleSheet.flatten(screen.getByRole('button').props.style).height;
  const hiddenKey = key();
  await view.rerender(shown(totals(1, 1), false));
  expect(key()).toBe(hiddenKey);
});

test('a long Money in amount scales to one line inside its row instead of wrapping or clipping', async () => {
  await render(shown(totals(99999999999, 1), false));
  await fireEvent(screen.getAllByTestId('fit-box')[1]!, 'layout', LAYOUT(120));
  await fireEvent(screen.getAllByTestId('fit-content')[1]!, 'layout', LAYOUT(240));

  expect(screen.getAllByTestId('fit-content')[1]).toHaveStyle({
    transform: [{ scale: 0.5 }],
    transformOrigin: 'right bottom',
  });
  expect(StyleSheet.flatten(screen.getByTestId('money-in').props.style).height).toBe(58);
});
