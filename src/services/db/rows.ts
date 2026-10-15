import type { z } from 'zod';

import type { SqlRow } from './port';

/** Columns that fold into a nested object, as `TransactionSchema` nests `account`. */
const NESTED: Readonly<Record<string, readonly [parent: string, key: string]>> = {
  account_name: ['account', 'name'],
  account_last4: ['account', 'last4'],
};

const camel = (column: string) => column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/**
 * A row in the shape the model schemas expect: snake_case columns become camelCase keys, and `account_*`
 * columns fold into `account`. Only the columns a query selected appear, so a masked query that selected
 * `amount_minor` hands the strict `MaskedRowSchema` an `amountMinor` key, and the parse fails.
 */
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

/**
 * Parses rows one at a time, so one tampered row is dropped and counted instead of failing the page.
 * Callers map `skipped > 0` to `{ kind: 'invalid_data', skipped }`.
 */
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
