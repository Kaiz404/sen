import type { ReactNode } from 'react';

import { AUTH_STATES } from '@/features/auth';

import { COMPONENT_STATES } from './component-states';

export type ScreenStates = Readonly<Record<string, () => ReactNode>>;

export const SCREENS: Readonly<Record<string, ScreenStates>> = {
  ...COMPONENT_STATES,
  auth: AUTH_STATES,
};

export function isComponent(screen: string): boolean {
  return screen in COMPONENT_STATES;
}
