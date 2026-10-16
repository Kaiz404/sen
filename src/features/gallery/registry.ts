import type { ReactNode } from 'react';

import { ADD_STATES } from '@/features/add';
import { AUTH_STATES } from '@/features/auth';
import { DETAIL_STATES } from '@/features/detail';
import { SECURITY_STATES } from '@/features/security';
import { SEN_STATES } from '@/features/sen';
import { SETTINGS_STATES } from '@/features/settings';
import { HISTORY_STATES } from '@/features/transactions';

import { COMPONENT_STATES } from './component-states';

export type ScreenStates = Readonly<Record<string, () => ReactNode>>;

export const SCREENS: Readonly<Record<string, ScreenStates>> = {
  ...COMPONENT_STATES,
  add: ADD_STATES,
  auth: AUTH_STATES,
  detail: DETAIL_STATES,
  history: HISTORY_STATES,
  motion: SEN_STATES,
  security: SECURITY_STATES,
  settings: SETTINGS_STATES,
};

export function isComponent(screen: string): boolean {
  return screen in COMPONENT_STATES;
}
