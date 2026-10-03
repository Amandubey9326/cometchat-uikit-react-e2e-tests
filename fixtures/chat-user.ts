import fs from 'node:fs';
import type { Browser, BrowserContext, BrowserContextOptions, Page, PlaywrightWorkerOptions, TestInfo } from '@playwright/test';
import { env } from '@config/env';
import type { TestUser } from '@data/personas';
import { ChatApp } from '@pages/ChatApp';
import { NetWatch } from './net-watch';

/** One signed-in user = own browser context + page + page objects + network watch. */
export interface ChatUser {
  user: TestUser;
  context: BrowserContext;
  page: Page;
  app: ChatApp;
  net: NetWatch;
}

export interface OpenedChatUser extends ChatUser {
  dispose(testInfo: TestInfo): Promise<void>;
}

/**
 * Opens a new context for `user`. Extra contexts do not get Playwright's
 * automatic failure screenshot / video, so this handles both: on failure a
 * screenshot and the video are attached, labelled with the user.
 */
export async function openChatUser(
  browser: Browser,
  options: BrowserContextOptions,
  user: TestUser,
  label: string,
  testInfo: TestInfo,
  video: PlaywrightWorkerOptions['video'],
  { seedCredentials = false }: { seedCredentials?: boolean } = {}
): Promise<OpenedChatUser> {
  const videoMode = typeof video === 'string' ? video : video.mode;
  const recordVideo = videoMode === 'off' ? undefined : { dir: testInfo.outputPath(`video-${label}`) };
  const context = await browser.newContext({ ...options, recordVideo });
  if (seedCredentials) {
    // Skip the App Credentials screen (covered by tests/auth/credentials.spec.ts): same values a user would type.
    await context.addInitScript(creds => {
      if (!localStorage.getItem('appId')) {
        localStorage.setItem('appId', creds.appId);
        localStorage.setItem('region', creds.region);
        localStorage.setItem('authKey', creds.authKey);
      }
    }, { appId: env.appId, region: env.region, authKey: env.authKey });
  }
  const page = await context.newPage();
  const net = new NetWatch(label);
  net.attach(page);

  return {
    user,
    context,
    page,
    app: new ChatApp(page),
    net,
    async dispose(info: TestInfo) {
      const failed = info.status !== info.expectedStatus;
      if (failed && !page.isClosed()) {
        const shot = await page.screenshot({ fullPage: true }).catch(() => undefined);
        if (shot) await info.attach(`${label}-failure.png`, { body: shot, contentType: 'image/png' });
      }
      const videoFile = page.video();
      await context.close();
      if (videoFile && recordVideo) {
        const file = await videoFile.path().catch(() => undefined);
        const keep = videoMode === 'on' || (failed && videoMode !== 'off');
        if (file && keep) await info.attach(`${label}-video.webm`, { path: file, contentType: 'video/webm' });
        else fs.rmSync(recordVideo.dir, { recursive: true, force: true });
      }
      await net.finish(info);
    },
  };
}
