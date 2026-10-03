import { RUN_PREFIX } from '@config/run';

let counter = 0;

/** Short id, unique within the run across workers (for user / group ids, never message text). */
export function shortId(): string {
  counter += 1;
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return `${Date.now().toString(36).slice(-5)}${worker}${counter}${Math.random().toString(36).slice(2, 4)}`;
}

/** Framework-owned id, e.g. pw-<run>-u-<short>. */
export function ownedId(kind: 'u' | 'g', label?: string): string {
  const safe = label ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 16)}` : '';
  return `${RUN_PREFIX}${kind}-${shortId()}${safe}`;
}

/*
 * Message text.
 *
 * The production app runs AI moderation (spam, scam, platform circumvention,
 * toxicity) plus phone / e-mail / profanity filters, all set to BLOCK. Random
 * codes next to words like "receipt" or "order" are blocked as scams, and
 * near-identical repeated lines as spam (see docs/test-data-map.md §7). So
 * message text is a friendly sentence whose unique marker is made of plain
 * words and a small number — never long digit runs (phone filter) or "@x.y".
 */
const ADJECTIVES = [
  'amber', 'azure', 'brisk', 'calm', 'cheery', 'cosy', 'crisp', 'dapper', 'eager', 'fancy', 'gentle', 'golden',
  'happy', 'jolly', 'kind', 'lively', 'lucky', 'mellow', 'merry', 'misty', 'nimble', 'polite', 'quiet', 'rosy',
  'sandy', 'silver', 'sunny', 'swift', 'tidy', 'velvet', 'warm', 'witty',
];
const NOUNS = [
  'acorn', 'badger', 'beacon', 'birch', 'canyon', 'cedar', 'comet', 'daisy', 'falcon', 'fern', 'glacier', 'harbor',
  'heron', 'island', 'juniper', 'lagoon', 'lantern', 'maple', 'meadow', 'otter', 'pebble', 'pine', 'quartz', 'raven',
  'river', 'saffron', 'sparrow', 'thistle', 'tulip', 'valley', 'willow', 'zephyr',
];
const OPENERS = [
  'Quick note about', 'Thinking about', 'A thought on', 'Reminder about', 'Some news on', 'Chatting about',
  'Update on', 'Question about', 'Idea for', 'Story about',
];

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Unique, human-looking marker, e.g. "amber otter meadow 42". */
export function uniqueMarker(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(NOUNS)} ${Math.floor(Math.random() * 100)}`;
}

/** A natural sentence that only this test sends, e.g. "Update on the amber otter meadow 42 (smoke)". */
export function uniqueText(label = 'chat'): string {
  return `${pick(OPENERS)} the ${uniqueMarker()} (${label})`;
}

/** `count` different natural sentences sharing one marker (history, rapid sends, ordering). */
export function uniqueSentences(count: number, label = 'chat'): { marker: string; texts: string[] } {
  const marker = uniqueMarker();
  const texts = Array.from({ length: count }, (_, i) => {
    const opener = OPENERS[i % OPENERS.length];
    const detail = `${ADJECTIVES[(i * 7) % ADJECTIVES.length]} ${NOUNS[(i * 11) % NOUNS.length]}`;
    return `${opener} the ${detail}, part ${i + 1} of ${marker} (${label})`;
  });
  return { marker, texts };
}
