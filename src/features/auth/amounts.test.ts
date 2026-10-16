import { act, renderHook } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import type { OpenDb } from '@/services/db';
import { queryClient } from '@/services/query-client';
import * as Vault from '@/services/vault';

import { dropRevealedOnHide, hideAmounts, showAmounts, useAmountsHidden } from './amounts';
import { dispatch, lockNow, sessionStore, signOut, unlock } from './session';

jest.mock('expo-local-authentication', () => ({
  ...jest.requireActual('expo-local-authentication'),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/services/vault', () => ({ openVault: jest.fn(), destroyVault: jest.fn(async () => undefined) }));

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
  queryClient.clear();
  sessionStore.setState({ session: { status: 'unlocked', since: 0, db }, amountsHidden: true });
  stopDropping = dropRevealedOnHide();
});

afterEach(() => stopDropping());

const shown = () => !sessionStore.getState().amountsHidden;

test('showing asks for strong biometrics every time', async () => {
  authenticate.mockResolvedValue({ success: true });

  expect(await showAmounts()).toEqual({ ok: true });
  expect(shown()).toBe(true);
  hideAmounts();
  expect(await showAmounts()).toEqual({ ok: true });

  expect(authenticate.mock.calls).toEqual([[SHOW_PROMPT], [SHOW_PROMPT]]);
  expect(shown()).toBe(true);
});

test('a cancelled check leaves amounts hidden', async () => {
  authenticate.mockResolvedValueOnce({ success: false, error: 'user_cancel' });

  expect(await showAmounts()).toEqual({ ok: false, reason: 'cancelled' });

  expect(shown()).toBe(false);
});

test('hiding never prompts', async () => {
  authenticate.mockResolvedValue({ success: true });
  await showAmounts();
  authenticate.mockClear();

  hideAmounts();

  expect(authenticate).not.toHaveBeenCalled();
  expect(shown()).toBe(false);
});

test('hiding drops revealed amounts and keeps the masked pages', async () => {
  authenticate.mockResolvedValue({ success: true });
  await showAmounts();
  queryClient.setQueryData(['tx', 'page', 0], ['Tealive']);
  queryClient.setQueryData(['tx', 'revealed', 0], { t1: 4250 });

  hideAmounts();

  expect(queryClient.getQueryData(['tx', 'revealed', 0])).toBeUndefined();
  expect(queryClient.getQueryData(['tx', 'page', 0])).toEqual(['Tealive']);
});

test('a cold start is masked, whatever the last session did', () => {
  let fresh: typeof sessionStore | undefined;
  jest.isolateModules(() => {
    fresh = jest.requireActual<typeof import('./session')>('./session').sessionStore;
  });

  expect(fresh?.getState().amountsHidden).toBe(true);
});

test.each(['manual', 'idle', 'background'] as const)(
  'a %s lock re-hides shown amounts, and the next unlock still lands masked',
  async (reason) => {
    authenticate.mockResolvedValue({ success: true });
    jest.mocked(Vault.openVault).mockResolvedValueOnce({ kind: 'opened', db });
    await showAmounts();
    queryClient.setQueryData(['tx', 'revealed', 0], { t1: 4250 });

    dispatch({ type: 'LOCK', reason });
    expect(sessionStore.getState().amountsHidden).toBe(true);
    expect(queryClient.getQueryData(['tx', 'revealed', 0])).toBeUndefined();
    expect(await unlock()).toEqual({ ok: true });

    expect(sessionStore.getState().session).toMatchObject({ status: 'unlocked', db });
    expect(sessionStore.getState().amountsHidden).toBe(true);
  },
);

test('showing again after the unlock takes a fresh biometric check', async () => {
  authenticate.mockResolvedValue({ success: true });
  jest.mocked(Vault.openVault).mockResolvedValueOnce({ kind: 'opened', db });
  await showAmounts();
  lockNow();
  await unlock();
  authenticate.mockClear();

  await showAmounts();

  expect(authenticate.mock.calls).toEqual([[SHOW_PROMPT]]);
  expect(shown()).toBe(true);
});

test('signing out re-hides shown amounts', async () => {
  authenticate.mockResolvedValue({ success: true });
  await showAmounts();

  await signOut();

  expect(sessionStore.getState().session).toEqual({ status: 'welcome' });
  expect(sessionStore.getState().amountsHidden).toBe(true);
});

test('a failed sign-out from Lock leaves amounts hidden', async () => {
  sessionStore.setState({ session: { status: 'locked', reason: 'manual' } });
  jest.mocked(Vault.destroyVault).mockRejectedValueOnce(new Error('keychain'));

  await expect(signOut()).rejects.toThrow('keychain');

  expect(sessionStore.getState().session).toMatchObject({ status: 'locked' });
  expect(sessionStore.getState().amountsHidden).toBe(true);
});

test('the hook follows show, hide and lock', async () => {
  authenticate.mockResolvedValue({ success: true });
  const { result } = await renderHook(() => useAmountsHidden());
  expect(result.current).toBe(true);

  await act(() => showAmounts());
  expect(result.current).toBe(false);

  await act(() => lockNow());
  expect(result.current).toBe(true);
});
