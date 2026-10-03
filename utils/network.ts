import type { Page } from '@playwright/test';

/**
 * Simulates a slow server for the `nth` request matching `url` + `method`
 * (1-based); every other request passes through untouched.
 */
export async function delayResponse(
  page: Page,
  url: RegExp,
  { method = 'GET', nth = 1, ms }: { method?: string; nth?: number; ms: number }
): Promise<void> {
  let seen = 0;
  await page.route(url, async route => {
    if (route.request().method() === method && ++seen === nth) {
      await new Promise(resolve => setTimeout(resolve, ms));
    }
    await route.continue();
  });
}
