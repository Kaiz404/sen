import type { ExpoConfig } from 'expo/config';

const INK = '#17181A';
const CANVAS = '#F6F2E9';

const fonts = {
  wordmark: './assets/fonts/BricolageGrotesque96ptCondensed-ExtraBold.ttf',
  numerals: './assets/fonts/BricolageGrotesque-ExtraBold.ttf',
  monoMedium: './assets/fonts/IBMPlexMono-Medium.ttf',
  monoSemiBold: './assets/fonts/IBMPlexMono-SemiBold.ttf',
};

const config: ExpoConfig = {
  name: 'Sen',
  slug: 'sen',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'sen',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.kaiz404.sen',
    supportsTablet: false,
  },
  android: {
    package: 'com.kaiz404.sen',
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: CANVAS,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: INK, image: './assets/images/splash-blank.png' }],
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Sen uses Face ID to unlock and to confirm changes.' },
    ],
    [
      'expo-font',
      {
        ios: { fonts: Object.values(fonts) },
        android: {
          fonts: [
            {
              fontFamily: 'BricolageGrotesque96ptCondensed-ExtraBold',
              fontDefinitions: [{ path: fonts.wordmark, weight: 800 }],
            },
            {
              fontFamily: 'BricolageGrotesque-ExtraBold',
              fontDefinitions: [{ path: fonts.numerals, weight: 800 }],
            },
            {
              fontFamily: 'IBMPlexMono',
              fontDefinitions: [
                { path: fonts.monoMedium, weight: 500 },
                { path: fonts.monoSemiBold, weight: 600 },
              ],
            },
          ],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
