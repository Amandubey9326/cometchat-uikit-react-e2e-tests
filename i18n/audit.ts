import fs from 'node:fs';
import path from 'node:path';
import { env } from '@config/env';

/** Static checks of the translation files and of the keys the code asks for (no browser). */
type Dict = Record<string, string>;

const UIKIT_LOCALES = path.join(env.uikitDir, 'src', 'resources', 'CometChatLocalize', 'resources');
const SAMPLE_LOCALES = path.join(env.appDir, 'src', 'locales');

const readJson = (file: string): Dict => JSON.parse(fs.readFileSync(file, 'utf8')) as Dict;

export function uikitDict(locale: string): Dict {
  const dir = path.join(UIKIT_LOCALES, locale);
  return Object.assign({}, ...fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir, f))));
}

export function sampleDict(locale: string): Dict {
  const file = path.join(SAMPLE_LOCALES, `${locale}.json`);
  return fs.existsSync(file) ? readJson(file) : {};
}

export function locales(): string[] {
  return fs.readdirSync(UIKIT_LOCALES).filter(d => fs.statSync(path.join(UIKIT_LOCALES, d)).isDirectory()).sort();
}

/** Keys of `reference` missing from `dict`, and keys whose value is identical to English (possible untranslated text). */
export function compare(reference: Dict, dict: Dict): { missing: string[]; sameAsEnglish: string[] } {
  const missing = Object.keys(reference).filter(k => !(k in dict));
  const sameAsEnglish = Object.keys(reference).filter(k => k in dict && dict[k] === reference[k] && /[a-z]{3,}/i.test(reference[k]));
  return { missing, sameAsEnglish };
}

const USE_PATTERNS = [
  /getLocalizedString\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*\)/g,
  /\bt\?\.\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*\)/g,
  /\.t\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*\)/g,
  /\bloc\(\s*\w+\s*,\s*['"]([A-Za-z0-9_.-]+)['"]/g,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['__tests__', 'node_modules', 'resources', 'stories'].includes(entry.name)) out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every literal key passed to a translation function in `dir`, with the files that use it. */
export function usedKeys(dir: string): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const file of sourceFiles(dir)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of USE_PATTERNS) {
      for (const m of text.matchAll(pattern)) {
        const rel = path.relative(env.uikitDir, file);
        used.set(m[1], [...(used.get(m[1]) ?? []), rel]);
      }
    }
  }
  return used;
}

export const UIKIT_SRC = path.join(env.uikitDir, 'src');
export const SAMPLE_SRC = path.join(env.appDir, 'src');
