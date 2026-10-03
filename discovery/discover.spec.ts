import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Phase-0 discovery crawler — READ-ONLY.
 *
 * Logs in and records, for each screen, the accessibility tree (ARIA snapshot),
 * a screenshot and the `cometchat-*` class names present, plus console / HTTP /
 * WebSocket activity. It never sends, edits or deletes anything. (Opening a
 * conversation does emit read receipts for the logged-in user.)
 *
 * Output: docs/discovery/
 */
const OUT = path.resolve(__dirname, '..', 'docs', 'discovery');
const LOGIN_UID = process.env.DISCOVERY_UID ?? 'cometchat-uid-1';

const redact = (url: string) => url.split('?')[0];

test('crawl sample app (read-only)', async ({ page }) => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const log: string[] = [];
  const classes = new Map<string, Set<string>>();
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') log.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('response', r => {
    if (r.status() >= 400) log.push(`[http ${r.status()}] ${r.request().method()} ${redact(r.url())}`);
  });
  page.on('requestfailed', r => log.push(`[requestfailed] ${r.method()} ${redact(r.url())} ${r.failure()?.errorText}`));
  page.on('websocket', ws => {
    log.push(`[ws open] ${redact(ws.url())}`);
    ws.on('close', () => log.push(`[ws close] ${redact(ws.url())}`));
  });

  let n = 0;
  const snap = async (name: string, scope: Locator = page.locator('body')) => {
    const id = `${String(++n).padStart(2, '0')}-${name}`;
    try {
      fs.writeFileSync(path.join(OUT, `${id}.aria.yml`), await scope.ariaSnapshot());
    } catch (e) {
      log.push(`[snap failed] ${id}: ${(e as Error).message.split('\n')[0]}`);
    }
    await page.screenshot({ path: path.join(OUT, `${id}.png`) }).catch(() => {});
    const found: string[] = await page
      .evaluate(() => {
        const s = new Set<string>();
        document.querySelectorAll('[class*="cometchat-"]').forEach(el =>
          el.classList.forEach(c => c.startsWith('cometchat-') && s.add(c))
        );
        return [...s];
      })
      .catch(() => []);
    classes.set(id, new Set(found));
  };

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      log.push(`[step ok] ${name}`);
    } catch (e) {
      log.push(`[step FAILED] ${name}: ${(e as Error).message.split('\n').slice(0, 6).join(' | ')}`);
      await page.keyboard.press('Escape').catch(() => {});
    }
  };

  const settle = (p: Page) => p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  // ── 1. Credentials screen ────────────────────────────────────────────────
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await snap('credentials');

  await page.getByText(process.env.COMETCHAT_REGION!.toUpperCase(), { exact: true }).click();
  await page.getByLabel('APP ID').fill(process.env.COMETCHAT_APP_ID!);
  await page.getByLabel('Auth Keys').fill(process.env.COMETCHAT_AUTH_KEY!);
  await page.getByRole('button', { name: 'Continue' }).click();

  // ── 2. Login screen ──────────────────────────────────────────────────────
  await expect(page.locator('#uid-input')).toBeVisible();
  await settle(page);
  await snap('login');

  await page.locator('#uid-input').fill(LOGIN_UID);
  await page.locator('.cometchat-login__submit-button').click();

  // ── 3. Home + tabs ───────────────────────────────────────────────────────
  await expect(page.locator('.cometchat-conversations')).toBeVisible({ timeout: 60_000 });
  await settle(page);
  await snap('home-chats');

  for (const tab of ['Calls', 'Users', 'Groups', 'Chats']) {
    await step(`tab ${tab}`, async () => {
      await page.locator('.cometchat-tab-component__tab').filter({ hasText: tab }).first().click();
      await expect(
        page.getByRole('option').first()
          .or(page.locator('.cometchat-call-logs__list-item, [class*="empty-state-view"]').first())
      ).toBeVisible({ timeout: 30_000 });
      await snap(`tab-${tab.toLowerCase()}`);
    });
  }

  const chats = page.getByRole('region', { name: 'Chats' });
  const tab = (name: string) => page.locator('.cometchat-tab-component__tab').filter({ hasText: name }).first();
  const header = page.getByRole('banner').first();

  // Conversations header menu (create conversation / logout)
  await step('conversations header menu', async () => {
    await chats.getByRole('button', { name: 'More options' }).click();
    await expect(page.getByText(/log ?out/i).first()).toBeVisible();
    await snap('conversations-header-menu');
    await page.keyboard.press('Escape');
  });

  // Global search (conversations search box)
  await step('global search', async () => {
    await chats.getByRole('searchbox', { name: 'Search' }).click();
    await settle(page);
    await snap('global-search');
    // Escape does not close global search — use its Back button.
    await page.getByRole('search', { name: 'Search' }).getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('listbox', { name: 'Conversations list' })).toBeVisible();
  });

  // ── 4. Open a 1:1 conversation ───────────────────────────────────────────
  await step('open first conversation', async () => {
    await page.getByRole('listbox', { name: 'Conversations list' }).getByRole('option').first().click();
    await expect(page.locator('.cometchat-message-bubble').first()).toBeVisible({ timeout: 30_000 });
    await snap('conversation-open');
    await snap('message-list', page.getByRole('region', { name: 'Message list' }));
  });

  await step('composer attachment menu', async () => {
    await page.getByRole('button', { name: 'ATTACHMENTS' }).click();
    await expect(page.getByRole('button', { name: 'Attach Image' })).toBeVisible();
    await snap('composer-attachment-menu');
    await page.keyboard.press('Escape');
  });

  await step('header + composer trees', async () => {
    await snap('message-header', header);
    await snap('message-composer', page.locator('.cometchat-message-composer').first());
  });

  await step('composer emoji keyboard', async () => {
    await page.getByRole('button', { name: 'EMOJI' }).click();
    await expect(page.getByRole('dialog', { name: 'Emoji keyboard' })).toBeVisible();
    await snap('composer-emoji');
    await page.keyboard.press('Escape');
  });

  await step('composer stickers keyboard', async () => {
    await page.getByRole('button', { name: 'Sticker' }).click();
    await expect(page.getByRole('dialog', { name: 'Sticker keyboard' })).toBeVisible();
    await settle(page);
    await snap('composer-stickers');
    await page.keyboard.press('Escape');
  });

  await step('composer mention suggestions (typed, not sent)', async () => {
    const input = page.getByRole('textbox', { name: 'Type a message' });
    await input.click();
    await input.pressSequentially('@');
    await settle(page);
    await snap('composer-mentions');
    await input.press('Backspace');
    await page.keyboard.press('Escape');
  });

  await step('message hover + options menu', async () => {
    const msg = page.getByRole('log', { name: 'Message list' }).getByRole('article').last();
    await msg.locator('.cometchat-message-bubble__body').first().hover();
    await snap('message-hover', msg);
    await msg.getByRole('button', { name: 'More options' }).click();
    await expect(page.getByRole('menuitem').first()).toBeVisible();
    await settle(page);
    await snap('message-options-menu');
    await page.keyboard.press('Escape');
  });

  await step('message reaction picker', async () => {
    const msg = page.getByRole('log', { name: 'Message list' }).getByRole('article').last();
    await msg.locator('.cometchat-message-bubble__body').first().hover();
    await msg.getByRole('button', { name: 'React' }).click();
    await settle(page);
    await snap('message-reaction-picker');
    await page.keyboard.press('Escape');
  });

  await step('message header search', async () => {
    await header.getByRole('button', { name: 'Search' }).click();
    await settle(page);
    await snap('message-search');
    await page.keyboard.press('Escape');
  });

  await step('user details panel', async () => {
    await header.getByRole('button', { name: /Click for details/ }).click();
    await settle(page);
    await snap('user-details');
  });

  // ── 5. Users tab → user chat ─────────────────────────────────────────────
  await step('users tab → open user', async () => {
    await tab('Users').click();
    await page.getByRole('region', { name: 'Users' }).getByRole('option').first().click();
    await expect(page.locator('.cometchat-message-composer')).toBeVisible();
    await settle(page);
    await snap('user-chat-from-users-tab');
  });

  // ── 6. Group conversation + details ──────────────────────────────────────
  await step('groups tab → open group + details', async () => {
    await tab('Groups').click();
    await page.getByRole('region', { name: 'Groups' }).getByRole('option', { name: /Hiking Group/ }).first().click();
    await settle(page);
    await snap('group-open');
    await header.getByRole('button', { name: /Click for details/ }).click();
    await settle(page);
    await snap('group-details');
  });

  await step('create group dialog', async () => {
    await tab('Groups').click();
    await page.getByRole('button', { name: 'Create group' }).click();
    await settle(page);
    await snap('create-group-dialog');
    // Escape does not close the dialog — use its Close button.
    await page.getByRole('dialog', { name: 'New Group' }).getByRole('button', { name: 'Close' }).click();
  });

  // ── 7. Call logs ─────────────────────────────────────────────────────────
  await step('call logs → details', async () => {
    await tab('Calls').click();
    await settle(page);
    await page.locator('.cometchat-call-logs__list-item').first().click();
    await settle(page);
    await snap('call-log-details');
  });

  // ── Write summaries ──────────────────────────────────────────────────────
  const all = new Set<string>();
  classes.forEach(s => s.forEach(c => all.add(c)));
  fs.writeFileSync(path.join(OUT, 'cometchat-classes.txt'), [...all].sort().join('\n'));
  fs.writeFileSync(path.join(OUT, 'crawl-log.txt'), log.join('\n'));
});
