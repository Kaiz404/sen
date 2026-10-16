import { type Instant, toInstant } from '@/models/day';
import { type AppError, err, ok, type Result } from '@/models/errors';
import type { PrefValue } from '@/models/prefs';

import { type BankRow, type DatasetSize, generateBankRows, mintRow, SEED } from './seed';

export type BankFailure = Extract<AppError, { kind: 'offline' | 'timeout' | 'server' }>;

/** Rows after `since` in feed order, at most `limit` of them. */
export type PageRequest = { readonly since: number; readonly limit: number };

/**
 * The bank's one endpoint. A body is a `TransactionPageSchema` envelope whose items carry their feed `seq`.
 * `nextSeq` is null once the page reaches the end of the feed. The body is untrusted until parsed.
 */
export interface BankApi {
  fetchPage(request: PageRequest): Promise<Result<unknown, BankFailure>>;
}

export type BankScenario = {
  readonly next: PrefValue<'demo.next'>;
  readonly size: DatasetSize;
  readonly slow: boolean;
  readonly newOnRefresh: boolean;
};

const SLOW_MS = 3000;

/** A failure answers after `afterMs`. A timeout waits out its deadline first, as a real one would. */
const FAILURE: {
  readonly [K in BankScenario['next']]: { readonly error: BankFailure; readonly afterMs: number } | null;
} = {
  normal: null,
  bad_data: null,
  offline: { error: { kind: 'offline' }, afterMs: 0 },
  timeout: { error: { kind: 'timeout' }, afterMs: 8000 },
  server: { error: { kind: 'server' }, afterMs: 0 },
};

const LOOKS_REAL = {
  id: 'bk-junk',
  amountMinor: 1250,
  currency: 'MYR',
  type: 'debit',
  description: 'Kedai Runcit Ah Seng',
  merchant: 'Kedai Runcit Ah Seng',
  category: 'groceries',
  status: 'posted',
  postedAt: '2026-10-01T04:00:00.000Z',
  reference: 'FT26100100000000',
  account: { name: 'Everyday Savings', last4: '4821' },
  source: 'bank',
};

const BAD_ROWS: readonly unknown[] = [
  { ...LOOKS_REAL, id: 'bk-junk-float', amountMinor: 12.5 },
  { ...LOOKS_REAL, id: 'bk-junk-category', category: 'crypto' },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createMockBank(options: {
  readonly scenario: () => BankScenario;
  readonly now?: () => Instant;
  readonly wait?: (ms: number) => Promise<void>;
  readonly seed?: number;
}): BankApi {
  const { scenario, now = () => toInstant(new Date()), wait = sleep, seed = SEED } = options;
  const feeds = new Map<DatasetSize, readonly BankRow[]>();
  const feed = (size: DatasetSize) => {
    const known = feeds.get(size);
    if (known !== undefined) return known;
    const rows = generateBankRows(size, now(), seed);
    feeds.set(size, rows);
    return rows;
  };

  return {
    async fetchPage({ since, limit }) {
      const { next, size, slow, newOnRefresh } = scenario();
      if (slow) await wait(SLOW_MS);
      const failure = FAILURE[next];
      if (failure !== null) {
        if (failure.afterMs > 0) await wait(failure.afterMs);
        return err(failure.error);
      }

      const rows = feed(size);
      const served =
        since < rows.length
          ? rows.slice(since, since + limit)
          : newOnRefresh
            ? [mintRow(since + 1, now(), seed)]
            : [];
      const items = next === 'bad_data' ? [...served, ...BAD_ROWS] : served;
      return ok({ items, nextSeq: since + limit < rows.length ? since + limit : null });
    },
  };
}
