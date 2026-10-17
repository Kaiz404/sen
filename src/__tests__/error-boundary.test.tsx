import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { ErrorBoundary } from '@/features/errors';

const APP = join(__dirname, '..', 'app');
const UNGUARDED = new Set([
  'lock.tsx',
  'welcome.tsx',
  'primer.tsx',
  'dev/states.tsx',
  '+not-found.tsx',
]);

let broken = true;
function Breaks() {
  if (broken) throw new Error('could not read RM 1,234.50 from /data/sen.db');
  return <Text>screen:fixed</Text>;
}

const routes = {
  index: { default: () => <Text>screen:history</Text>, ErrorBoundary },
  broken: { default: Breaks, ErrorBoundary },
};

beforeEach(() => {
  broken = true;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

test('a screen that throws shows Sen and two ways out, never the error text', async () => {
  await renderRouter(routes, { initialUrl: '/broken' });

  expect(screen.getByRole('header', { name: 'Something went wrong.' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Back to History' })).toBeOnTheScreen();
  expect(screen.queryByText(/1,234|sen\.db|could not read/)).not.toBeOnTheScreen();
});

test('Try again renders the screen again', async () => {
  await renderRouter(routes, { initialUrl: '/broken' });
  broken = false;

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('screen:fixed')).toBeOnTheScreen();
});

test('Back to History leaves the broken screen', async () => {
  await renderRouter(routes, { initialUrl: '/broken' });

  await fireEvent.press(screen.getByRole('button', { name: 'Back to History' }));

  expect(await screen.findByText('screen:history')).toBeOnTheScreen();
});

test('the root layout and every protected route export the boundary', () => {
  const COVERED_BY_ADD_LAYOUT = ['add/index.tsx', 'add/details.tsx', 'add/review.tsx'];
  const files = readdirSync(APP, { recursive: true, encoding: 'utf8' }).filter(
    (file) =>
      file.endsWith('.tsx') && !UNGUARDED.has(file) && !COVERED_BY_ADD_LAYOUT.includes(file),
  );
  const missing = files.filter(
    (file) =>
      !readFileSync(join(APP, file), 'utf8').includes(
        "export { ErrorBoundary } from '@/features/errors';",
      ),
  );

  expect(files.length).toBeGreaterThan(8);
  expect(missing).toEqual([]);
});
