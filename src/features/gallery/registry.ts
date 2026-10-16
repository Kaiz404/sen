import type { ReactNode } from 'react';

import { AUTH_STATES } from '@/features/auth';

import { COMPONENT_STATES } from './component-states';

/** One screen's states, each drawn from fixtures only. No services, no database. */
export type ScreenStates = Readonly<Record<string, () => ReactNode>>;

/**
 * Every screen the gallery draws, keyed by the `screen` query param. A lane registers a screen with one entry
 * here, importing its states from its own feature index, where the fixtures live. Components draw in a captioned
 * frame. Every other screen draws edge to edge, as it does in the app.
 */
export const SCREENS: Readonly<Record<string, ScreenStates>> = {
  ...COMPONENT_STATES,
  auth: AUTH_STATES,
};

export function isComponent(screen: string): boolean {
  return screen in COMPONENT_STATES;
}
