const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

const babel = resolveBabelOptions(__dirname);

module.exports = {
  preset: 'jest-expo/android',
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { ...babel, caller: { ...babel.caller, platform: 'android', supportsReactCompiler: true } },
    ],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
