const EVENTS = {
  'vault.created': 'info',
  'vault.opened': 'info',
  'vault.reset.missing_key': 'warn',
  'vault.reset.corrupt': 'warn',
  'vault.destroyed': 'info',
  'sync.done': 'info',
  'sync.superseded': 'info',
  'sync.failed.offline': 'warn',
  'sync.failed.timeout': 'warn',
  'sync.failed.server': 'warn',
  'sync.failed.invalid_data': 'warn',
  'haptics.failed': 'warn',
  'guard.failed': 'warn',
} as const satisfies Record<string, 'info' | 'warn'>;

export type LogCode = keyof typeof EVENTS;

export function logEvent(code: LogCode): void {
  if (!__DEV__) return;
  console[EVENTS[code]](`[sen] ${code}`);
}

/** A dev-only timing line, `[sen] perf <mark> +<ms>`, for the coordinator to read from logcat. */
export function logTiming(mark: string, ms: number): void {
  if (!__DEV__) return;
  console.info(`[sen] perf ${mark} +${Math.round(ms)}ms`);
}
