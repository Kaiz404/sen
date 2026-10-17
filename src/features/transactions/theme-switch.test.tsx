import '@shopify/flash-list/jestSetup';

import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ToastHost } from '@/components/toast';
import { dark, light } from '@/theme/colors';
import { applyTheme } from '@/theme/unistyles';

import { HISTORY_STATES } from './fixtures';

const darkValues = new Set(Object.values(dark));
/** Light colours that dark mode never uses: one of these on screen after a switch to Dark is stale. */
const LIGHT_ONLY = new Set(Object.values(light).filter((c) => !darkValues.has(c)));

type Host = { type: unknown; props: Record<string, any>; children: readonly (Host | string)[] };

const textOf = (node: Host): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

function hosts(node: Host): Host[] {
  return [node, ...node.children.flatMap((c) => (typeof c === 'string' ? [] : hosts(c)))];
}

/** Every host text, input and icon under `root` that still wears a light-only colour. */
function staleText(root: Host): string[] {
  return hosts(root)
    .filter((n) => typeof n.type === 'string' && /Text/.test(n.type))
    .flatMap((n) => {
      const style = StyleSheet.flatten(n.props.style) ?? {};
      const colors = [style.color, n.props.color, n.props.placeholderTextColor];
      return colors
        .filter((c): c is string => typeof c === 'string' && LIGHT_ONLY.has(c))
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
