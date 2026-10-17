const EVENTS = {
  'vault.created': 'info',
  'vault.opened': 'info',
  'vault.reset.missing_key': 'warn',
  'vault.reset.corrupt': 'warn',
  'vault.open_failed.full': 'warn',
  'vault.open_failed.key': 'warn',
  'vault.open_failed.store': 'warn',
  'vault.destroyed': 'info',
  'sync.done': 'info',
  'sync.superseded': 'info',
  'sync.failed.offline': 'warn',
  'sync.failed.timeout': 'warn',
  'sync.failed.server': 'warn',
  'sync.failed.storage': 'warn',
  'sync.failed.unknown': 'warn',
  'sync.failed.invalid_data': 'warn',
  'db.close.failed': 'warn',
  'haptics.failed': 'warn',
  'auth.unlocked': 'info',
  'auth.failed': 'info',
  'lock.locked': 'info',
  'amounts.revealed': 'info',
  'amounts.hidden': 'info',
  'tx.added': 'info',
  'tx.deleted': 'info',
  'tx.undone': 'info',
  'tx.erased': 'info',
  'settings.weakened': 'info',
  'demo.reset': 'info',
  'log.cleared': 'info',
  'activity.write_failed': 'warn',
  'guard.failed': 'warn',
  'ui.render_error': 'warn',
} as const satisfies Record<string, 'info' | 'warn'>;

export type LogCode = keyof typeof EVENTS;

export function logEvent(code: LogCode): void {
  if (!__DEV__) return;
  console[EVENTS[code]](`[sen] ${code}`);
}

/** The steps from a passed biometric prompt to History's first paint, in the order they happen. */
export const UNLOCK_MARKS = [
  'unlock.ok',
  'vault.opened',
  'arriving',
  'arrived',
  'history.mounted',
  'history.rows',
  'history.painted',
] as const;

export type UnlockMark = (typeof UNLOCK_MARKS)[number];

/** A dev-only timing line, `[sen] perf <mark> +<ms>`, for the coordinator to read from logcat. */
export function logTiming(mark: UnlockMark, ms: number): void {
  if (!__DEV__) return;
  console.info(`[sen] perf ${mark} +${Math.round(ms)}ms`);
}
