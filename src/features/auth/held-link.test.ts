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
