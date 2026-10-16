import { act, renderHook } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import type { OpenDb } from '@/services/db';
import { clearPrefs, readPref, writePref } from '@/services/prefs';
import { queryClient } from '@/services/query-client';
import * as Vault from '@/services/vault';

import { dropRevealedOnHide, hideAmounts, showAmounts, useAmountsHidden } from './amounts';
import { lockNow, sessionStore, unlock } from './session';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/vault', () => ({ openVault: jest.fn() }));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;
const SHOW_PROMPT = {
  promptMessage: 'Show amounts',
  biometricsSecurityLevel: 'strong',
  disableDeviceFallback: false,
};

let stopDropping: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  clearPrefs();
  queryClient.clear();
  sessionStore.setState({ session: { status: 'unlocked', since: 0, db } });
  stopDropping = dropRevealedOnHide();
});

afterEach(() => stopDropping());

test('showing asks for strong biometrics every time', async () => {
  authenticate.mockResolvedValue({ success: true });

  expect(await showAmounts()).toEqual({ ok: true });
  expect(readPref('hideAmounts')).toBe(false);
  hideAmounts();
  expect(await showAmounts()).toEqual({ ok: true });

  expect(authenticate.mock.calls).toEqual([[SHOW_PROMPT], [SHOW_PROMPT]]);
  expect(readPref('hideAmounts')).toBe(false);
});

test('a cancelled check leaves amounts hidden', async () => {
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

  expect(await showAmounts()).toEqual({ ok: false, reason: 'cancelled' });

  expect(readPref('hideAmounts')).toBe(true);
});

test('hiding never prompts', () => {
  writePref('hideAmounts', false);

  hideAmounts();

  expect(authenticate).not.toHaveBeenCalled();
  expect(readPref('hideAmounts')).toBe(true);
});

test('hiding drops revealed amounts and keeps the masked pages', () => {
  writePref('hideAmounts', false);
  queryClient.setQueryData(['tx', 'page', 0], ['Tealive']);
  queryClient.setQueryData(['tx', 'revealed', 0], { t1: 4250 });

  hideAmounts();

  expect(queryClient.getQueryData(['tx', 'revealed', 0])).toBeUndefined();
  expect(queryClient.getQueryData(['tx', 'page', 0])).toEqual(['Tealive']);
});

test('clearing prefs hides amounts and drops the revealed ones', () => {
  writePref('hideAmounts', false);
  queryClient.setQueryData(['tx', 'revealed', 0], { t1: 4250 });

  clearPrefs();

  expect(readPref('hideAmounts')).toBe(true);
  expect(queryClient.getQueryData(['tx', 'revealed', 0])).toBeUndefined();
});

test('shown amounts stay shown through a lock and unlock', async () => {
  authenticate.mockResolvedValue({ success: true });
  jest.mocked(Vault.openVault).mockResolvedValueOnce({ kind: 'opened', db });
  await showAmounts();

  lockNow();
  expect(await unlock()).toEqual({ ok: true });

  expect(sessionStore.getState().session).toMatchObject({ status: 'unlocked', db });
  expect(readPref('hideAmounts')).toBe(false);
});

test('the hook follows every writer', async () => {
  const { result } = await renderHook(() => useAmountsHidden());
  expect(result.current).toBe(true);

  await act(() => writePref('hideAmounts', false));
  expect(result.current).toBe(false);

  await act(() => clearPrefs());
  expect(result.current).toBe(true);
});
