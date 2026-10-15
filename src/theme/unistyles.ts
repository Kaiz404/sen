import { StyleSheet } from 'react-native-unistyles';

const light = {
  colors: {
    canvas: '#F6F2E9',
    paper: '#FFFDF8',
    ink: '#17181A',
    inkMuted: '#5F5A50',
    lemon: '#F2DC72',
  },
} as const;

const dark = {
  colors: {
    canvas: '#121315',
    paper: '#1E2023',
    ink: '#F3EEE3',
    inkMuted: '#ABA595',
    lemon: '#F2DC72',
  },
} as const;

const themes = { light, dark };

type AppThemes = typeof themes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes,
  settings: { adaptiveThemes: true },
});
