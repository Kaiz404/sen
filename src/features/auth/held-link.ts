import { Linking } from 'react-native';

import { gateOf } from './machine';
import { sessionStore } from './session';

export type DetailPath = `/transaction/${string}`;

const DETAIL_LINK = /^[a-z][a-z0-9+.-]*:\/\/\/?transaction\/([^/?#]+)\/?(?:[?#].*)?$/i;

/** The route a detail link opens, or null. Only a detail is held through Lock: a sheet or a setting is not. */
export function detailPathOf(url: string): DetailPath | null {
  const id = DETAIL_LINK.exec(url)?.[1];
  return id === undefined ? null : `/transaction/${id}`;
}

let held: DetailPath | null = null;

/** While unlocked the router opens a link itself. Otherwise the newest link wins, and a non-detail link drops it. */
function hold(url: string | null): void {
  if (url === null || gateOf(sessionStore.getState().session) === 'unlocked') return;
  held = detailPathOf(url);
}

/** Holds a detail link that opens the app while it is locked, from a cold start or a running app. */
export function startLinkHold(): () => void {
  void Linking.getInitialURL().then(hold, () => {});
  const subscription = Linking.addEventListener('url', ({ url }) => hold(url));
  return () => subscription.remove();
}

/** The held link, once. */
export function takeHeldLink(): DetailPath | null {
  const path = held;
  held = null;
  return path;
}
