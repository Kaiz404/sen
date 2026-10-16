const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

const babel = resolveBabelOptions(__dirname);

module.exports = {
  preset: 'jest-expo/android',
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Benches time real work, so they run alone and serially through `npm run test:bench`.
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
