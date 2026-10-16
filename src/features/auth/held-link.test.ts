import { type EmitterSubscription, Linking } from 'react-native';

import type { OpenDb } from '@/services/db';

import { detailPathOf, startLinkHold, takeHeldLink } from './held-link';
import { dispatch, sessionStore } from './session';

test.each([
  ['sen://transaction/bk-17', '/transaction/bk-17'],
  ['sen:///transaction/m-7f3c2a10', '/transaction/m-7f3c2a10'],
  ['sen://transaction/bk-17/', '/transaction/bk-17'],
  ['sen://transaction/bk-17?from=push', '/transaction/bk-17'],
  ['sen://transaction/bk-17/delete', null],
  ['sen://settings/erase', null],
  ['sen://dev/states?screen=detail', null],
  ['sen://transaction/', null],
  ['https://example.com/transaction/bk-17', null],
  ['https://transaction/bk-17', null],
  ['exp+sen://transaction/bk-17', null],
  ['SEN://transaction/bk-17', '/transaction/bk-17'],
])('%s holds %s', (url, path) => {
  expect(detailPathOf(url)).toBe(path);
});

describe('holding', () => {
  let send: (url: string) => void = () => {};
  const db = { close: jest.fn(async () => undefined) } as unknown as OpenDb;

  beforeEach(() => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValueOnce(null);
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, listener) => {
      send = (url) => listener({ url });
      return { remove: jest.fn() } as unknown as EmitterSubscription;
    });
    sessionStore.setState({ session: { status: 'locked', reason: 'manual' } });
    takeHeldLink();
  });

  test('a detail link that arrives while locked is held once, and a newer non-detail link drops it', () => {
    const stop = startLinkHold();
    send('sen://transaction/bk-17');
    expect(takeHeldLink()).toBe('/transaction/bk-17');
    expect(takeHeldLink()).toBeNull();

    send('sen://transaction/bk-17');
    send('sen://settings/erase');
    expect(takeHeldLink()).toBeNull();
    stop();
  });

  test('a link that arrives on Welcome is not held through setup', () => {
    sessionStore.setState({ session: { status: 'welcome' } });
    const stop = startLinkHold();
    send('sen://transaction/bk-17');
    dispatch({ type: 'AUTH_START' });
    dispatch({ type: 'UNLOCK_OK', at: 0, db });
    dispatch({ type: 'ARRIVED' });

    expect(sessionStore.getState().session.status).toBe('unlocked');
    expect(takeHeldLink()).toBeNull();
    stop();
  });

  test('a cold-start link is dropped by Welcome whether it resolves before or after the launch', async () => {
    let initial: (url: string) => void = () => {};
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockReset()
      .mockReturnValueOnce(new Promise((resolve) => (initial = resolve)))
      .mockResolvedValueOnce('sen://transaction/bk-17');

    sessionStore.setState({ session: { status: 'launching' } });
    let stop = startLinkHold();
    dispatch({ type: 'LAUNCHED', hasVault: false });
    initial('sen://transaction/bk-17');
    await Promise.resolve();
    expect(takeHeldLink()).toBeNull();
    stop();

    sessionStore.setState({ session: { status: 'launching' } });
    stop = startLinkHold();
    await Promise.resolve();
    dispatch({ type: 'LAUNCHED', hasVault: false });
    expect(takeHeldLink()).toBeNull();
    stop();
  });

  test('a cold-start link is held when the launch finds a vault', async () => {
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockReset()
      .mockResolvedValueOnce('sen://transaction/bk-17');
    sessionStore.setState({ session: { status: 'launching' } });
    const stop = startLinkHold();
    await Promise.resolve();
    dispatch({ type: 'LAUNCHED', hasVault: true });

    expect(takeHeldLink()).toBe('/transaction/bk-17');
    stop();
  });

  test('signing out drops a held link and holds none while it runs, even if it fails back to Lock', () => {
    const stop = startLinkHold();
    send('sen://transaction/bk-17');
    dispatch({ type: 'SIGN_OUT_START' });
    send('sen://transaction/bk-18');
    dispatch({ type: 'SIGN_OUT_FAIL' });

    expect(sessionStore.getState().session).toEqual({ status: 'locked', reason: 'signout' });
    expect(takeHeldLink()).toBeNull();
    stop();
  });

  test('a link that arrives while unlocked is left to the router', () => {
    const stop = startLinkHold();
    dispatch({ type: 'AUTH_START' });
    dispatch({ type: 'UNLOCK_OK', at: 0, db });
    dispatch({ type: 'ARRIVED' });
    expect(sessionStore.getState().session.status).toBe('unlocked');

    send('sen://transaction/bk-17');
    expect(takeHeldLink()).toBeNull();
    stop();
  });
});
