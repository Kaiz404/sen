import type { z } from 'zod';

import type { SqlRow } from './port';

const NESTED: Readonly<Record<string, readonly [parent: string, key: string]>> = {
  account_name: ['account', 'name'],
  account_last4: ['account', 'last4'],
};

const camel = (column: string) => column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function fromColumns(row: SqlRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    const nested = NESTED[column];
    if (nested === undefined) {
      out[camel(column)] = value;
      continue;
    }
    const [parent, key] = nested;
    const group = out[parent];
    out[parent] = { ...(typeof group === 'object' && group !== null ? group : {}), [key]: value };
  }
  return out;
}

export function parseRows<T>(
  rows: readonly SqlRow[],
  schema: z.ZodType<T>,
): { readonly rows: readonly T[]; readonly skipped: number } {
  const parsed: T[] = [];
  for (const row of rows) {
    const result = schema.safeParse(fromColumns(row));
    if (result.success) parsed.push(result.data);
  }
  return { rows: parsed, skipped: rows.length - parsed.length };
}
