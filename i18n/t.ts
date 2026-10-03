import fs from 'node:fs';
import path from 'node:path';
import { env } from '@config/env';

/**
 * Accessible names come from the same locale files the app uses, so page
 * objects stay valid in every locale. Resolution mirrors CometChatLocalize:
 * current locale → en-us → the key itself (which is also what the app shows
 * for a missing key — see BUG-001).
 */
type Dict = Record<string, string>;

const UIKIT_LOCALES = path.join(env.uikitDir, 'src', 'resources', 'CometChatLocalize', 'resources');
const SAMPLE_LOCALES = path.join(env.appDir, 'src', 'locales');

function readJson(file: string): Dict {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Dict) : {};
}

function loadLocale(locale: string): Dict {
  const dir = path.join(UIKIT_LOCALES, locale);
  const uikit = fs.existsSync(dir)
    ? Object.assign({}, ...fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir, f))))
    : {};
  // The sample app merges its own strings on top via addTranslation().
  return { ...uikit, ...readJson(path.join(SAMPLE_LOCALES, `${locale}.json`)) };
}

const FALLBACK = 'en-us';
const fallback = loadLocale(FALLBACK);
if (Object.keys(fallback).length === 0) {
  throw new Error(`No ${FALLBACK} strings found under ${UIKIT_LOCALES} — check APP_DIR / UIKIT_DIR.`);
}
const current = env.locale === FALLBACK ? fallback : loadLocale(env.locale);

export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = current[key] ?? fallback[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
}

/** Available locale codes shipped with the UIKit. */
export function uikitLocales(): string[] {
  return fs.readdirSync(UIKIT_LOCALES).filter(d => fs.statSync(path.join(UIKIT_LOCALES, d)).isDirectory());
}
