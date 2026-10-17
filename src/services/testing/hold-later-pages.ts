import type { MockBank } from '../bank-api';

/**
 * Holds every page after the first of one request, so a test can look at a sync between its pages. Slow mode no
 * longer pauses there: it delays a request once. `release` lets the held pages through, and the hold ends with it.
 */
export function holdLaterPages(bank: MockBank): { release(): void } {
  const under = bank.under.bind(bank);
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  jest.spyOn(bank, 'under').mockImplementation((scenario) => {
    const api = under(scenario);
    let pages = 0;
    return {
      async fetchPage(request) {
        if (pages++ > 0) await released;
        return api.fetchPage(request);
      },
    };
  });
  return {
    release: () => {
      release();
      jest.mocked(bank.under).mockRestore();
    },
  };
}
