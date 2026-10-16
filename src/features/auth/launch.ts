import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { LaunchTarget } from '@/features/sen';

type Launch = {
  /** Where the first screen draws its Sen and how tall its hero is, once it has laid out. */
  readonly target: LaunchTarget | null;
  /** The cold-start launch has played or been skipped. It plays once per process. */
  readonly done: boolean;
};

export const launchStore = createStore<Launch>(() => ({ target: null, done: false }));

/** Lock and Welcome call this from their hero's layout. Later layouts move the handoff with them. */
export function reportLaunchTarget(target: LaunchTarget): void {
  if (!launchStore.getState().done) launchStore.setState({ target });
}

export function finishLaunch(): void {
  launchStore.setState({ done: true });
}

export function useLaunchDone(): boolean {
  return useStore(launchStore, (s) => s.done);
}
