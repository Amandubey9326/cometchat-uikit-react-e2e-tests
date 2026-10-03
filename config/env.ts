import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';

export const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export type CometChatEnv = 'prod' | 'staging';

export interface Env {
  cometchatEnv: CometChatEnv;
  appId: string;
  region: string;
  authKey: string;
  apiKey: string;
  /** CometChat REST (admin) API base, e.g. https://<appId>.api-us.cometchat.io/v3 */
  restBase: string;
  /** CometChat client API base (what the SDK calls with a user's auth token), e.g. https://<appId>.apiclient-us.cometchat.io/v3.0 */
  clientBase: string;
  /** Hosts handed to the sample app; empty = SDK defaults (production). */
  appHosts: { client: string; admin: string };
  /** Sample-app folder (Vite project) and the UIKit repo that contains it. */
  appDir: string;
  uikitDir: string;
  appPort: number;
  baseURL: string;
  /** UI locale the tests expect (drives t()). */
  locale: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function load(): Env {
  const cometchatEnv = (process.env.COMETCHAT_ENV?.trim() || 'prod') as CometChatEnv;
  if (cometchatEnv !== 'prod' && cometchatEnv !== 'staging') {
    throw new Error(`COMETCHAT_ENV must be "prod" or "staging", got "${cometchatEnv}".`);
  }
  const appId = required('COMETCHAT_APP_ID');
  const region = required('COMETCHAT_REGION').toLowerCase();
  const appDir = path.resolve(process.env.APP_DIR?.trim() || path.join(os.homedir(), 'uikit-react', 'sample-app'));
  const locale = process.env.PW_LOCALE?.trim() || 'en-us';
  // Each UI locale gets its own build and port, so a server left running for one locale is never
  // reused for another (webServer.reuseExistingServer).
  const localeOffset = locale === 'en-us' ? 0 : 1 + [...locale].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 89, 0);
  const appPort = Number(process.env.APP_PORT ?? 3105 + localeOffset);
  const isProd = cometchatEnv === 'prod';

  return {
    cometchatEnv,
    appId,
    region,
    authKey: required('COMETCHAT_AUTH_KEY'),
    apiKey: required('COMETCHAT_API_KEY'),
    restBase: isProd
      ? `https://${appId}.api-${region}.cometchat.io/v3`
      : `https://${appId}.api-${region}.cometchat-staging.com/v3`,
    clientBase: isProd
      ? `https://${appId}.apiclient-${region}.cometchat.io/v3.0`
      : `https://${appId}.apiclient-${region}.cometchat-staging.com/v3.0`,
    appHosts: isProd
      ? { client: '', admin: '' }
      : {
          client: `${appId}.apiclient-${region}.cometchat-staging.com/v3`,
          admin: `${appId}.api-${region}.cometchat-staging.com/v3`,
        },
    appDir,
    uikitDir: path.resolve(process.env.UIKIT_DIR?.trim() || path.join(appDir, '..')),
    appPort,
    baseURL: process.env.BASE_URL?.trim() || `http://localhost:${appPort}`,
    locale,
  };
}

export const env: Env = load();
