import { z } from 'zod';

import { InstantSchema } from './day';

type Pref<S extends z.ZodType> = { readonly schema: S; readonly default: z.infer<S> };

function pref<S extends z.ZodType>(schema: S, fallback: z.infer<S>): Pref<S> {
  return { schema, default: fallback };
}

/**
 * What the in-app mock bank remembers between launches, as a real bank would: when its feed was generated, and the
 * rows it minted on refresh, per dataset size, so it can still post them after a restart.
 */
export const BankStateSchema = z.object({
  anchor: InstantSchema.nullable(),
  minted: z.record(
    z.string(),
    z.array(z.object({ seq: z.number().int().positive(), postedAt: InstantSchema })),
  ),
});
export type BankState = z.infer<typeof BankStateSchema>;
export const NO_BANK_STATE: BankState = { anchor: null, minted: {} };

const TABLE = {
  theme: pref(z.enum(['light', 'dark', 'system']), 'system'),
  idleLock: pref(z.union([z.literal(2), z.literal(5), z.literal(10)]), 5),
  relockAfter: pref(z.union([z.literal(0), z.literal(1), z.literal(5)]), 1),
  senMotion: pref(z.enum(['full', 'calm', 'off']), 'full'),
  haptics: pref(z.boolean(), true),
  'demo.next': pref(z.enum(['normal', 'offline', 'timeout', 'server', 'bad_data']), 'normal'),
  'demo.datasetSize': pref(z.union([z.literal(20), z.literal(1000), z.literal(10000)]), 1000),
  'demo.slow': pref(z.boolean(), false),
  'demo.newOnRefresh': pref(z.boolean(), true),
} as const;

export type PrefKey = keyof typeof TABLE;
export type PrefValue<K extends PrefKey> = z.infer<(typeof TABLE)[K]['schema']>;
export type Prefs = { readonly [K in PrefKey]: PrefValue<K> };

export const PREFS: { readonly [K in PrefKey]: Pref<z.ZodType<PrefValue<K>>> } = TABLE;

export function parsePref<K extends PrefKey>(key: K, raw: unknown): PrefValue<K> {
  const parsed = PREFS[key].schema.safeParse(raw);
  return parsed.success ? parsed.data : PREFS[key].default;
}
