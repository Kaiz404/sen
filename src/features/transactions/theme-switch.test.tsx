import '@shopify/flash-list/jestSetup';

import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ToastHost } from '@/components/toast';
import { dark, light } from '@/theme/colors';
import { applyTheme } from '@/theme/unistyles';

import { HISTORY_STATES } from './fixtures';

const darkValues = new Set(Object.values(dark));
const lightValues = new Set(Object.values(light));
/** Light colours that dark mode never uses: one of these on screen after a switch to Dark is stale. */
const LIGHT_ONLY = new Set(Object.values(light).filter((c) => !darkValues.has(c)));
const DARK_ONLY = new Set(Object.values(dark).filter((c) => !lightValues.has(c)));

type Host = { type: unknown; props: Record<string, any>; children: readonly (Host | string)[] };

const textOf = (node: Host): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

function hosts(node: Host): Host[] {
  return [node, ...node.children.flatMap((c) => (typeof c === 'string' ? [] : hosts(c)))];
}

/** Every host text, input and icon under `root` that still wears a colour only the other theme uses. */
function staleText(root: Host, stale: ReadonlySet<string> = LIGHT_ONLY): string[] {
  return hosts(root)
    .filter((n) => typeof n.type === 'string' && /Text/.test(n.type))
    .flatMap((n) => {
      const style = StyleSheet.flatten(n.props.style) ?? {};
      const colors = [style.color, n.props.color, n.props.placeholderTextColor];
      return colors
        .filter((c): c is string => typeof c === 'string' && stale.has(c))
        .map((c) => `${textOf(n) || n.props.placeholder || n.type} ${c}`);
    });
}

/**
 * History's list rides the pull gesture's animated view, and on the phone a live theme switch left stylesheet-only
 * text colours there on the old theme. Each part reads its text colours in render, so a switch re-colours them.
 */
test.each([
  'masked',
  'shown',
  'search-shown',
  'in-filter',
  'loading',
  'empty',
  'no-results',
  'bad-data',
  'db-reset',
  'offline',
  'refreshing',
  'updated',
] as const)('History "%s": every text in the list follows a switch to Dark', async (state) => {
  jest.useFakeTimers();
  await render(HISTORY_STATES[state]());
  await act(() => jest.advanceTimersByTime(1000));

  await act(() => applyTheme('dark'));

  const list = screen.getByTestId('history-list') as unknown as Host;
  expect(staleText(list)).toEqual([]);
  jest.useRealTimers();
});

test('the pull label follows a switch to Dark', async () => {
  await render(HISTORY_STATES.refreshing());

  await act(() => applyTheme('dark'));

  expect(screen.getByText('CHECKING WITH YOUR BANK')).toHaveStyle({ color: dark.inkMuted });
});

test('a row title goes from light ink to dark ink and back', async () => {
  await render(HISTORY_STATES.masked());
  const title = () => screen.getByText('Lunch with Hafiz, cash');
  const before = StyleSheet.flatten(title().props.style).color;

  await act(() => applyTheme('dark'));
  const during = StyleSheet.flatten(title().props.style).color;
  await act(() => applyTheme('light'));

  expect([before, during, StyleSheet.flatten(title().props.style).color]).toEqual([
    light.ink,
    dark.ink,
    light.ink,
  ]);
});

test('the undo toast over History follows a switch to Dark', async () => {
  await render(
    <>
      {HISTORY_STATES['add-key-lifted']()}
      <ToastHost />
    </>,
  );

  await act(() => applyTheme('dark'));

  expect(screen.getByText('Added')).toHaveStyle({ color: dark.canvas });
  expect(screen.getByText('Undo')).toHaveStyle({ color: dark.onPastel });
});

/**
 * On the phone: History masked under Dark, Settings › Theme › Light, then Show amounts. Rows and the month card that
 * mounted under Dark drew their revealed digits in dark ink, because nothing had read the theme while they were masked.
 */
test('amounts revealed after a switch from Dark to Light take the light ink', async () => {
  applyTheme('dark');
  const view = await render(HISTORY_STATES.masked());
  await act(() => applyTheme('light'));

  await view.rerender(HISTORY_STATES.shown());

  const amounts = [
    ...screen.getAllByTestId('amount-roll'),
    ...screen.getAllByTestId('digit-column'),
  ] as unknown as Host[];
  const card = screen.getByTestId('month-card') as unknown as Host;
  expect(hosts(card).some((n) => n.props.testID === 'digit-column')).toBe(true);
  expect(amounts.length).toBeGreaterThan(5);
  expect(amounts.flatMap((a) => staleText(a, DARK_ONLY))).toEqual([]);
  expect(staleText(screen.getByTestId('history-list') as unknown as Host, DARK_ONLY)).toEqual([]);
});
