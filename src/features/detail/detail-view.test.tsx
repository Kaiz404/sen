import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { dark, light } from '@/theme/colors';
import { applyTheme } from '@/theme/unistyles';

import { DETAIL_STATES } from './fixtures';

afterEach(() => applyTheme('light'));

const textColors = (root: { props: Record<string, any>; children: readonly unknown[] }): string[] => [
  ...(typeof StyleSheet.flatten(root.props.style)?.color === 'string'
    ? [StyleSheet.flatten(root.props.style).color as string]
    : []),
  ...root.children.flatMap((c) => (typeof c === 'string' ? [] : textColors(c as typeof root))),
];

// On the phone the amount mounted hidden under Dark, and after a switch to Light it showed in dark ink.
test('the amount shown after a switch from Dark to Light takes the light ink', async () => {
  applyTheme('dark');
  const view = await render(DETAIL_STATES.masked());
  await act(() => applyTheme('light'));

  await view.rerender(DETAIL_STATES.shown());

  const columns = screen.getAllByTestId('digit-column');
  expect(columns.length).toBeGreaterThan(3);
  expect(new Set(columns.flatMap((c) => textColors(c as never)))).toEqual(new Set([light.ink]));
});

const iconColor = () => StyleSheet.flatten(screen.getByTestId('source-icon').props.style).color;

test('the bank source icon is ink on its chip, so it stays readable in dark mode', async () => {
  await render(DETAIL_STATES.masked());
  expect(iconColor()).toBe(light.ink);

  await act(() => applyTheme('dark'));
  expect(iconColor()).toBe(dark.ink);
});

test('the added-on-this-phone icon stays dark on its lilac chip in both themes', async () => {
  await render(DETAIL_STATES.manual());
  await act(() => applyTheme('dark'));
  expect(iconColor()).toBe(dark.onPastel);
});
