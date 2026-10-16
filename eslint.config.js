const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

const layer = (target, ...allowed) => ({
  target: `./src/${target}`,
  from: './src',
  except: [`./${target}`, ...allowed.map((name) => `./${name}`)],
  message: `src/${target} may import only from: ${[target, ...allowed].join(', ')}.`,
});

const rawHex = {
  selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
  message: 'Use a semantic token from src/theme, never raw hex.',
};
const cubicBezierString = {
  selector: 'Literal[value=/cubic-bezier\\(/]',
  message: 'Use the cubicBezier ports in src/motion/tokens.ts.',
};
const sharedValueDotValue = {
  selector: "MemberExpression[property.name='value']",
  message: 'Use .get() and .set() on shared values. The React Compiler cannot see .value.',
};

const exclusiveTransaction = {
  selector: "Identifier[name='withExclusiveTransactionAsync']",
  message:
    'withExclusiveTransactionAsync opens a second connection without the SQLCipher key. Use db.transaction.',
};

const nodeSqliteAtRuntime = {
  selector:
    ":matches(ImportExpression[source.value='node:sqlite'], CallExpression[callee.name='require'][arguments.0.value='node:sqlite'])",
  message: 'Jest only. App code opens the database through openDb from @/services/db.',
};

const showAmountsWithoutStepUp = {
  selector: "CallExpression[callee.name='writePref'][arguments.0.value='hideAmounts']",
  message: 'Show or hide amounts with showAmounts() or hideAmounts() from @/features/auth. Showing needs step-up.',
};

const restrictedImports = {
  paths: [
    {
      name: 'react-native-reanimated',
      importNames: ['useReducedMotion'],
      message: 'Read the motion level through useMotionPolicy() from src/motion/policy.',
    },
    {
      name: 'react-native-reanimated',
      importNames: ['runOnJS'],
      message: 'Use scheduleOnRN from react-native-worklets.',
    },
    {
      name: 'react-native-worklets',
      importNames: ['runOnJS'],
      message: 'Use scheduleOnRN from react-native-worklets.',
    },
  ],
  patterns: [
    {
      group: ['@/features/*/**'],
      message: "Import another feature through its index, as '@/features/<name>'.",
    },
  ],
};

/** The Node adapter runs only in Jest. Metro can't bundle node:sqlite, so app code never imports it. */
const withTestOnly = (options) => ({
  paths: [
    ...options.paths,
    {
      name: 'node:sqlite',
      message: 'Jest only. App code opens the database through openDb from @/services/db.',
    },
  ],
  patterns: [
    ...options.patterns,
    {
      group: ['**/db/testing', '**/db/testing/*', './testing', './testing/*'],
      message: 'The Node database adapter is for test files only.',
    },
  ],
});

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  { ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'coverage/*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      'no-console': 'error',
      'import/no-cycle': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            layer('models'),
            layer('theme'),
            layer('motion', 'theme'),
            layer('services', 'models'),
            layer('components', 'models', 'theme', 'motion'),
            layer('features', 'services', 'models', 'components', 'theme', 'motion'),
            layer('app', 'features', 'components', 'theme', 'motion'),
          ],
        },
      ],
      'no-restricted-imports': ['error', withTestOnly(restrictedImports)],
      'no-restricted-syntax': [
        'error',
        rawHex,
        cubicBezierString,
        sharedValueDotValue,
        exclusiveTransaction,
        nodeSqliteAtRuntime,
        showAmountsWithoutStepUp,
      ],
    },
  },
  {
    files: ['src/features/auth/amounts.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        rawHex,
        cubicBezierString,
        sharedValueDotValue,
        exclusiveTransaction,
        nodeSqliteAtRuntime,
      ],
    },
  },
  {
    files: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        cubicBezierString,
        sharedValueDotValue,
        exclusiveTransaction,
        nodeSqliteAtRuntime,
      ],
    },
  },
  {
    files: ['src/motion/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        rawHex,
        sharedValueDotValue,
        exclusiveTransaction,
        nodeSqliteAtRuntime,
      ],
    },
  },
  {
    files: ['src/services/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', rawHex, cubicBezierString, exclusiveTransaction],
      'no-restricted-imports': ['error', restrictedImports],
    },
  },
  {
    files: ['src/services/db/testing/**'],
    rules: { 'no-restricted-imports': ['error', restrictedImports] },
  },
  {
    files: ['src/app/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'Expo Router bundles every file in src/app as a route. Put route tests in src/__tests__/.',
        },
      ],
    },
  },
]);
