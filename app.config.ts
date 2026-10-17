import type { ExpoConfig } from 'expo/config';

const INK = '#17181A';

const fonts = {
  wordmark: './assets/fonts/BricolageGrotesque96ptCondensed-ExtraBold.ttf',
  numerals: './assets/fonts/BricolageGrotesque-ExtraBold.ttf',
  monoMedium: './assets/fonts/IBMPlexMono-Medium.ttf',
  monoSemiBold: './assets/fonts/IBMPlexMono-SemiBold.ttf',
};

const config: ExpoConfig = {
  name: 'Sen',
  slug: 'sen',
  owner: 'kaiz404',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  primaryColor: INK,
  scheme: 'sen',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.kaiz404.sen',
    supportsTablet: false,
    icon: {
      light: './assets/images/icon.png',
      dark: './assets/images/ios-icon-dark.png',
      tinted: './assets/images/ios-icon-tinted.png',
    },
  },
  android: {
    package: 'com.kaiz404.sen',
    allowBackup: false,
    // Prebuild adds this for the dev overlay. The debug manifest declares it itself, so release drops it.
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
    adaptiveIcon: {
      backgroundColor: INK,
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: INK, image: './assets/images/splash-blank.png' }],
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-secure-store', { configureAndroidBackup: false }],
    './plugins/with-no-backup',
    [
      '@react-native-community/datetimepicker',
      {
        android: {
          // Hex copies of `src/theme/colors.ts`. Expo loads this file alone, so it cannot import the app's
          // source. `src/__tests__/app-config.test.ts` fails when they drift. The Inverse pair is the text on
          // the accent: the header and the selected day.
          datePicker: {
            colorAccent: { light: '#17181A', dark: '#F2DC72' },
            textColorPrimary: { light: '#17181A', dark: '#F3EEE3' },
            textColorSecondary: { light: '#5F5A50', dark: '#ABA595' },
            windowBackground: { light: '#F6F2E9', dark: '#121315' },
            textColorPrimaryInverse: { light: '#F6F2E9', dark: '#17181A' },
            textColorSecondaryInverse: { light: '#D8D2C4', dark: '#3F3B34' },
          },
        },
      },
    ],
    [
      'expo-build-properties',
      {
        android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true },
      },
    ],
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
  extra: {
    eas: { projectId: '7e499749-53df-4928-ae6a-38af453b3809' },
  },
};

export default config;
