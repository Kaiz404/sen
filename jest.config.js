const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

const babel = resolveBabelOptions(__dirname);

module.exports = {
  preset: 'jest-expo/android',
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Motion tests are CPU-bound. Workers past the physical core count add no throughput and only
  // stretch each test toward the 5 s timeout.
  maxWorkers: '50%',
  // jest-expo's list plus FlashList, which ships untranspiled ES modules.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@shopify/flash-list))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '\\.bench\\.test\\.ts$'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { ...babel, caller: { ...babel.caller, platform: 'android', supportsReactCompiler: true } },
    ],
  },
  moduleNameMapper: {
    '^react-native-reanimated/mock$': '<rootDir>/jest/reanimated-for-router.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
