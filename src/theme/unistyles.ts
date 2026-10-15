import { StyleSheet } from 'react-native-unistyles';

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

StyleSheet.configure({
  themes,
  settings: { adaptiveThemes: true },
});
