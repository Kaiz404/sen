import { Linking } from 'react-native';

import { lockIfAwayTooLong } from './locks';
import { gateOf, type Session } from './machine';
import { sessionStore } from './session';

export type DetailPath = `/transaction/${string}`;

const DETAIL_LINK = /^sen:\/\/\/?transaction\/([^/?#]+)\/?(?:[?#].*)?$/i;

/** The route a detail link opens, or null. Only a detail is held through Lock: a sheet or a setting is not. */
export function detailPathOf(url: string): DetailPath | null {
  const id = DETAIL_LINK.exec(url)?.[1];
  return id === undefined ? null : `/transaction/${id}`;
}

let held: DetailPath | null = null;

/** Welcome and sign-out lead to a new user's first unlock, which never opens the last user's link. */
function forNewUser(session: Session): boolean {
  return gateOf(session) === 'welcome' || session.status === 'signingOut';
}

/** While unlocked the router opens a link itself. Otherwise the newest link wins, and a non-detail link drops it. */
function hold(url: string | null): void {
  const { session } = sessionStore.getState();
  if (url === null || gateOf(session) === 'unlocked' || forNewUser(session)) return;
  held = detailPathOf(url);
}

/** Holds a detail link that opens the app while it is locked, from a cold start or a running app. */
export function startLinkHold(): () => void {
  void Linking.getInitialURL().then(hold, () => {});
  const subscription = Linking.addEventListener('url', ({ url }) => {
    lockIfAwayTooLong();
    hold(url);
  });
  const stopDropping = sessionStore.subscribe(({ session }) => {
    if (forNewUser(session)) held = null;
  });
  return () => {
    subscription.remove();
    stopDropping();
  };
}

/** The held link, once. */
export function takeHeldLink(): DetailPath | null {
  const path = held;
  held = null;
  return path;
}
