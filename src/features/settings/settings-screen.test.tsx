import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { toast, ToastHost } from '@/components/toast';
import { disarmLockout, useLockoutArmed } from '@/features/auth';
import type { OpenDb } from '@/services/db';
import { openTestDb } from '@/services/db/testing/node-adapter';
import { clearPrefs, readPref, writePref } from '@/services/prefs';

import { useSenMotionPreference } from './index';
import { SettingsScreen } from './settings-screen';

let mockDb: OpenDb;
const mockShow = jest.fn();
const mockPush = jest.fn();
const mockLock = jest.fn();

jest.mock('@/services/logger', () => ({ logEvent: jest.fn() }));
jest.mock('@/services/haptics', () => ({ playHaptic: jest.fn() }));
let mockParams: { focus?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/features/auth', () => ({
  ...jest.requireActual('@/features/auth'),
  useDb: () => mockDb,
  useBiometric: () => ({ kind: 'fingerprint', ready: true }),
  showAmounts: () => mockShow(),
  lockNow: () => mockLock(),
}));

beforeEach(async () => {
  jest.useFakeTimers();
  clearPrefs();
  mockShow.mockReset();
  mockPush.mockClear();
  mockLock.mockClear();
  disarmLockout();
  mockParams = {};
  mockDb = await openTestDb();
});
afterEach(async () => {
  await act(async () => toast.hide());
  jest.useRealTimers();
});

const renderSettings = () =>
  render(
    <>
      <SettingsScreen />
      <ToastHost />
    </>,
  );

const checked = (role: 'radio' | 'switch', name: string) =>
  screen.getByRole(role, { name }).props.accessibilityState.checked;

test('each reviewer control writes its pref, and the screen shows the new value', async () => {
  await renderSettings();

  await fireEvent.press(screen.getByRole('radio', { name: 'Server error 500' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'Slow network, add 3 s' }));
  await fireEvent.press(screen.getByRole('switch', { name: 'New transaction on refresh' }));

  expect([readPref('demo.next'), readPref('demo.slow'), readPref('demo.newOnRefresh')]).toEqual([
    'server',
    true,
    false,
  ]);
  expect(checked('radio', 'Server error 500')).toBe(true);
  expect(checked('radio', 'Normal')).toBe(false);
  expect(checked('switch', 'Slow network, add 3 s')).toBe(true);
});

test('a dataset switch that fails keeps the old size and says the rows are as they were', async () => {
  await renderSettings();
  await mockDb.close();

  await fireEvent.press(screen.getByRole('radio', { name: '10k' }));

  expect(await screen.findByText('Couldn’t switch the dataset')).toBeOnTheScreen();
  expect(screen.getByText('Your rows are as they were.')).toBeOnTheScreen();
  expect(readPref('demo.datasetSize')).toBe(1000);
  expect(checked('radio', '1k')).toBe(true);
});

test('a fault that turns itself off elsewhere reads Normal again on the open screen', async () => {
  writePref('demo.next', 'offline');
  await renderSettings();
  expect(checked('radio', 'Offline')).toBe(true);

  await act(() => writePref('demo.next', 'normal'));

  expect(checked('radio', 'Normal')).toBe(true);
});

test('the security choices write the lock windows', async () => {
  await renderSettings();

  await fireEvent.press(screen.getByRole('radio', { name: '10 min' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Right away' }));

  expect([readPref('idleLock'), readPref('relockAfter')]).toEqual([10, 0]);
});

test('turning off Hide amounts asks for biometrics, and a cancel leaves them hidden', async () => {
  mockShow.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
  await renderSettings();

  await fireEvent.press(screen.getByRole('switch', { name: 'Hide amounts' }));

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(readPref('hideAmounts')).toBe(true);
  expect(checked('switch', 'Hide amounts')).toBe(true);
});

test('turning Hide amounts back on hides at once, with no prompt', async () => {
  writePref('hideAmounts', false);
  await renderSettings();

  await fireEvent.press(screen.getByRole('switch', { name: 'Hide amounts' }));

  expect(mockShow).not.toHaveBeenCalled();
  expect(readPref('hideAmounts')).toBe(true);
});

test('Sen’s animations writes the motion level that the root layout reads', async () => {
  const { result } = await renderHook(() => useSenMotionPreference());
  await renderSettings();
  expect(result.current).toBe('full');

  await fireEvent.press(screen.getByRole('radio', { name: 'Calm' }));

  expect(result.current).toBe('calm');
  expect(screen.getByText('Blinks and face slides only.')).toBeOnTheScreen();
});

test('simulate lockout arms the next unlock, offers Undo, and a second tap disarms it', async () => {
  const armed = await renderHook(() => useLockoutArmed());
  await renderSettings();

  await fireEvent.press(screen.getByRole('button', { name: 'Simulate fingerprint lockout' }));

  expect(armed.result.current).toBe(true);
  expect(screen.getByRole('button', { name: 'Lockout armed' })).toBeOnTheScreen();
  expect(screen.getByText('The next unlock reports fingerprint locked.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo lockout' }));
  expect(armed.result.current).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Simulate fingerprint lockout' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Lockout armed' }));
  expect(armed.result.current).toBe(false);
  expect(screen.getByRole('button', { name: 'Simulate fingerprint lockout' })).toBeOnTheScreen();
});

test('Lock now locks through the session, which session.test covers', async () => {
  await renderSettings();

  await fireEvent.press(screen.getByRole('button', { name: 'Lock now' }));

  expect(mockLock).toHaveBeenCalledTimes(1);
});

test('opened at the reviewer controls, the screen scrolls there once and then leaves the scroll alone', async () => {
  mockParams = { focus: 'reviewers' };
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  await renderSettings();
  const layout = (y: number) =>
    fireEvent(screen.getByTestId('reviewers'), 'layout', { nativeEvent: { layout: { y } } });

  await layout(900);
  await layout(940);

  expect(scrollTo.mock.calls).toEqual([[{ y: 884, animated: false }]]);
  scrollTo.mockRestore();
});

test('the sheets open as their routes', async () => {
  await renderSettings();

  await fireEvent.press(screen.getByRole('button', { name: 'Reset demo data' }));
  await fireEvent.press(screen.getByRole('button', { name: 'How Sen keeps amounts private' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out of demo' }));

  expect(mockPush.mock.calls).toEqual([
    ['/settings/reset-demo'],
    ['/settings/privacy'],
    ['/settings/sign-out'],
  ]);
});
