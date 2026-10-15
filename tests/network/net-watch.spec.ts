import { expect, test } from '@fixtures/test.fixture';
import { NetWatch } from '@fixtures/net-watch';

/** A routed fake origin: the budget is checked without loading the app or touching the shared CometChat app. */
const PROBE = 'https://netwatch-probe.test';

test.describe('Error budget (NetWatch)', { tag: ['@network', '@regression'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${PROBE}/**`, route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>probe</title>' });
      if (pathname === '/server-error') return route.fulfill({ status: 500, body: '' });
      if (pathname === '/not-found') return route.fulfill({ status: 404, body: '' });
      return route.abort('connectionrefused');
    });
  });

  async function triggerEveryKind(page: import('@playwright/test').Page): Promise<void> {
    await page.goto(`${PROBE}/`);
    await page.evaluate(async () => {
      await fetch('/server-error');
      await fetch('/not-found');
      await fetch('/refused').catch(() => {});
      console.error('probe console error');
      setTimeout(() => {
        throw new Error('probe page error');
      });
    });
  }

  test('NET-05 page errors, 5xx and failed requests count against the budget; 4xx and console errors are only reported', async ({ page, net }) => {
    await triggerEveryKind(page);

    await expect.poll(() => net.unexpectedErrors().map(i => i.kind).sort()).toEqual(['http', 'pageerror', 'requestfailed']);
    const errors = net.unexpectedErrors().map(i => i.detail);
    expect(errors).toContainEqual(expect.stringContaining('500 GET https://netwatch-probe.test/server-error'));
    expect(errors).toContainEqual(expect.stringContaining('probe page error'));
    expect(errors).toContainEqual(expect.stringContaining('/refused'));

    const warnings = net.issues.filter(i => i.severity === 'warning').map(i => i.detail);
    expect(warnings).toContainEqual(expect.stringContaining('404 GET https://netwatch-probe.test/not-found'));
    expect(warnings).toContainEqual('probe console error');

    // Allowed patterns no longer count — this also keeps the fixture's own check from failing this test.
    net.allow(/server-error/, /probe page error/, /\/refused/);
    expect(net.unexpectedErrors()).toEqual([]);
  });

  test('NET-05 a passing test with an unexpected error is failed by the budget', async ({ page, net }, testInfo) => {
    test.skip(process.env.NET_STRICT === '0', 'NET_STRICT=0 turns the budget off');
    const probe = new NetWatch('probe');
    probe.attach(page);
    await triggerEveryKind(page);
    await expect.poll(() => probe.unexpectedErrors().length).toBe(3);

    await expect(probe.finish(testInfo)).rejects.toThrow(/\[probe\] unexpected browser errors/);

    net.allow(/server-error/, /probe page error/, /\/refused/);
  });
});
