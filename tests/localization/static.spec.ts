import { compare, locales, SAMPLE_SRC, sampleDict, UIKIT_SRC, uikitDict, usedKeys } from '@i18n/audit';
import { expect, test } from '@playwright/test';

/**
 * Static localization audit: runs without a browser, against the UIKit and sample-app sources the
 * app is built from. Each test attaches a report so the gaps are visible even when it fails as expected.
 */
test.describe('Localization — static audit', { tag: ['@localization', '@regression'] }, () => {
  const english = { ...uikitDict('en-us'), ...sampleDict('en-us') };

  test(
    'L10N-01 every UIKit locale has every en-us key',
    { annotation: { type: 'bug', description: 'L10N-001 — keys missing per locale' } },
    async ({}, testInfo) => {
      test.fail(true, 'L10N-001');
      const reference = uikitDict('en-us');
      const report = locales()
        .filter(l => l !== 'en-us')
        .map(l => ({ locale: l, ...compare(reference, uikitDict(l)) }));
      await testInfo.attach('uikit-locales.json', {
        body: JSON.stringify(report.map(r => ({ locale: r.locale, missing: r.missing, sameAsEnglish: r.sameAsEnglish.length })), null, 2),
        contentType: 'application/json',
      });

      expect(report.filter(r => r.missing.length).map(r => `${r.locale}: ${r.missing.length} missing`)).toEqual([]);
    }
  );

  test('L10N-02 every sample-app locale has every en-us key', async ({}, testInfo) => {
    const reference = sampleDict('en-us');
    const report = locales()
      .filter(l => l !== 'en-us')
      .map(l => ({ locale: l, ...compare(reference, sampleDict(l)) }));
    await testInfo.attach('sample-locales.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });

    expect(report.filter(r => r.missing.length).map(r => `${r.locale}: ${r.missing.join(', ')}`)).toEqual([]);
  });

  test(
    'L10N-03 every key the UIKit and sample app ask for exists in en-us',
    { annotation: { type: 'bug', description: 'BUG-001 — keys used in code but missing from en-us are shown raw' } },
    async ({}, testInfo) => {
      test.fail(true, 'BUG-001');
      const used = new Map([...usedKeys(UIKIT_SRC), ...usedKeys(SAMPLE_SRC)]);
      const missing = [...used].filter(([key]) => !(key in english)).map(([key, files]) => `${key}  (${[...new Set(files)].join(', ')})`);
      await testInfo.attach('keys-missing-from-en-us.txt', { body: missing.join('\n') || '(none)', contentType: 'text/plain' });

      expect(missing).toEqual([]);
    }
  );
});
