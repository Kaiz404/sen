import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { dark, light } from '@/theme/colors';
import { applyTheme } from '@/theme/unistyles';

import { DETAIL_STATES } from './fixtures';

afterEach(() => applyTheme('light'));

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
