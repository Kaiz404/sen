/** Every event Sen may log. A call takes one of these codes and nothing else, so no amount or text can reach a log. */
const EVENTS = {
  'vault.created': 'info',
  'vault.opened': 'info',
  'vault.reset.missing_key': 'warn',
  'vault.reset.corrupt': 'warn',
  'vault.destroyed': 'info',
  'sync.done': 'info',
  'sync.failed.offline': 'warn',
  'sync.failed.timeout': 'warn',
  'sync.failed.server': 'warn',
  'sync.failed.invalid_data': 'warn',
  'haptics.failed': 'warn',
} as const satisfies Record<string, 'info' | 'warn'>;

export type LogCode = keyof typeof EVENTS;

/** Development builds only. Release builds have no reader for logs, so they write none. */
export function logEvent(code: LogCode): void {
  if (!__DEV__) return;
  console[EVENTS[code]](`[sen] ${code}`);
}
