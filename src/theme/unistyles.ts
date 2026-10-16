import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { dark, light } from './colors';

const shape = {
  keyBorder: 2,
  keyShadow: 4,
  keyRadius: 18,
  touchMin: 44,
} as const;

const lightTheme = { colors: light, shape };
const darkTheme: typeof lightTheme = { colors: dark, shape };

const themes = { light: lightTheme, dark: darkTheme };

export type AppTheme = typeof lightTheme;
type AppThemes = typeof themes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

/** The Theme setting. System follows the phone's light or dark mode. */
export type ThemeChoice = keyof AppThemes | 'system';

/** Called once, before any screen module loads, with the saved choice, so the first frame already wears it. */
export function configureThemes(choice: ThemeChoice): void {
  StyleSheet.configure({
    themes,
    settings: choice === 'system' ? { adaptiveThemes: true } : { initialTheme: choice },
  });
}

/** Switches the live theme with no restart. Unistyles refuses `setTheme` while adaptive themes are on. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true);
    return;
  }
  UnistylesRuntime.setAdaptiveThemes(false);
  UnistylesRuntime.setTheme(choice);
}
