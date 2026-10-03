export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches an accessible name that starts with `text` as a whole word. */
export function startsWithWord(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}(?![\\w-])`);
}

export function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`);
}
