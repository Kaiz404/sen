import { type Instant, InstantSchema, toInstant } from '@/models/day';
import { type AppError, err, ok, type Result } from '@/models/errors';
import type { BankState, PrefValue } from '@/models/prefs';

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

/**
 * A pending payment posts this long after it was authorised. Two minutes is short enough that a reviewer who adds a
 * row with "New transaction on refresh" sees it post on a pull a little later, and long enough that the new row is
 * still pending on the refresh that brought it.
 */
export const SETTLE_AFTER_MS = 2 * 60 * 1000;

/** Rows that were pending when the bank sent them and have aged past `SETTLE_AFTER_MS`, with the time they posted. */
function settledBy(pending: Iterable<BankRow>, now: Instant) {
  const settled: { id: string; settledAt: Instant }[] = [];
  for (const row of pending) {
    const settledAt = toInstant(new Date(Date.parse(row.postedAt) + SETTLE_AFTER_MS));
    if (settledAt <= now) settled.push({ id: row.id, settledAt });
  }
  return settled;
}

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

/** Where the bank keeps its own state. The app backs it with a pref, so a restart finds it again. */
export type BankStateStore = { read(): BankState; write(state: BankState): void };

function memoryState(): BankStateStore {
  let state: BankState = { anchor: null, minted: {} };
  return { read: () => state, write: (next) => void (state = next) };
}

export type MockBank = {
  /** The bank as one request sees it. Every page answers under `scenario`, so a sync is one scenario throughout. */
  under(scenario: BankScenario): BankApi;
};

export function createMockBank(
  options: {
    readonly now?: () => Instant;
    readonly wait?: (ms: number) => Promise<void>;
    readonly seed?: number;
    readonly state?: BankStateStore;
  } = {},
): MockBank {
  const {
    now = () => toInstant(new Date()),
    wait = sleep,
    seed = SEED,
    state = memoryState(),
  } = options;
  const feeds = new Map<string, readonly BankRow[]>();
  /** The feed is generated from one anchor instant that the bank keeps, so it is the same feed after a restart. */
  const feed = (size: DatasetSize) => {
    const saved = state.read();
    const anchor = saved.anchor ?? now();
    if (saved.anchor === null) state.write({ ...saved, anchor });
    const key = `${size}@${anchor}`;
    const known = feeds.get(key);
    if (known !== undefined) return known;
    const rows = generateBankRows(size, anchor, seed);
    feeds.set(key, rows);
    return rows;
  };
  const remember = (size: DatasetSize, row: BankRow) => {
    const saved = state.read();
    const sent = (saved.minted[String(size)] ?? []).filter((m) => m.seq !== row.seq);
    sent.push({ seq: row.seq, postedAt: InstantSchema.parse(row.postedAt) });
    state.write({ ...saved, minted: { ...saved.minted, [String(size)]: sent } });
  };
  const mintedRows = (size: DatasetSize) =>
    (state.read().minted[String(size)] ?? []).map((m) => mintRow(m.seq, m.postedAt, seed));

  return {
    under: ({ next, size, slow, newOnRefresh }) => {
      // One `under` is one request, however many pages it takes. Slow mode and bad data act on its first page only,
      // so a 1,000-row sync waits 3 s once and carries two broken rows once, not once per page.
      let opening = true;
      return {
        async fetchPage({ since, limit }) {
          const first = opening;
          opening = false;
          if (slow && first) await wait(SLOW_MS);
          const failure = FAILURE[next];
          if (failure !== null) {
            if (failure.afterMs > 0) await wait(failure.afterMs);
            return err(failure.error);
          }

          const rows = feed(size);
          const refresh = since >= rows.length;
          const fresh = refresh && newOnRefresh ? mintRow(since + 1, now(), seed) : null;
          if (fresh !== null) remember(size, fresh);
          const served = refresh
            ? fresh === null
              ? []
              : [fresh]
            : rows.slice(since, since + limit);
          const items = next === 'bad_data' && first ? [...served, ...BAD_ROWS] : served;
          // Only a refresh reports postings, so a first sync shows the board's pending rows as sent.
          const modified = refresh
            ? settledBy(
                [...rows.filter((row) => row.status === 'pending'), ...mintedRows(size)],
                now(),
              )
            : [];
          return ok({
            items,
            modified,
            nextSeq: since + limit < rows.length ? since + limit : null,
          });
        },
      };
    },
  };
}
