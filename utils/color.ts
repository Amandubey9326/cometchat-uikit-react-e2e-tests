import type { Locator } from '@playwright/test';

/** Relative luminance (0 = black, 1 = white) of the first non-transparent background at or above `el`. */
export async function backgroundLuminance(el: Locator): Promise<number> {
  return el.evaluate(node => {
    let current: Element | null = node;
    while (current) {
      const [r, g, b, a = 1] = (getComputedStyle(current).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      if (a > 0 && r !== undefined) {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b!);
      }
      current = current.parentElement;
    }
    return 1; // page default is white
  });
}
