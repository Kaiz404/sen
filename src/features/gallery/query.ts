import { POSE_IDS, type PoseId } from '@/features/sen';

export type ThemeName = 'light' | 'dark';

export type GalleryQuery =
  | { readonly kind: 'index' }
  | { readonly kind: 'db' }
  | { readonly kind: 'poses' }
  | { readonly kind: 'pose'; readonly pose: PoseId; readonly size: number }
  | { readonly kind: 'state'; readonly screen: string; readonly state: string }
  | { readonly kind: 'unknown'; readonly reason: string };

export type Params = Readonly<Record<string, string | string[] | undefined>>;
type Registry = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isPose = (v: string): v is PoseId => (POSE_IDS as readonly string[]).includes(v);

export function parseQuery(params: Params, screens: Registry): GalleryQuery {
  const screen = one(params.screen);
  const state = one(params.state);
  if (screen === undefined) return { kind: 'index' };
  if (screen === 'db') return { kind: 'db' };

  if (screen === 'sen') {
    const pose = one(params.pose);
    if (pose === undefined) return { kind: 'poses' };
    if (!isPose(pose)) return { kind: 'unknown', reason: `No pose "${pose}".` };
    const size = Number(one(params.size) ?? 200);
    if (!(size > 0)) return { kind: 'unknown', reason: `Size must be a positive number of pt.` };
    return { kind: 'pose', pose, size };
  }

  const states = screens[screen];
  if (states === undefined) return { kind: 'unknown', reason: `No screen "${screen}".` };
  if (state === undefined || !(state in states))
    return {
      kind: 'unknown',
      reason: `Screen "${screen}" has states: ${Object.keys(states).join(', ')}.`,
    };
  return { kind: 'state', screen, state };
}

export function parseTheme(params: Params): ThemeName | undefined {
  const theme = one(params.theme);
  return theme === 'light' || theme === 'dark' ? theme : undefined;
}

export function shotName(query: GalleryQuery, theme: ThemeName | undefined): string | undefined {
  if (query.kind === 'state') return `${query.screen}-${query.state}-${theme ?? 'system'}`;
  if (query.kind === 'pose') return `pose-${query.pose}-${query.size}`;
  return undefined;
}
