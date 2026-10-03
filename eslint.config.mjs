import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', '.auth/', '.app-build/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty-pattern': 'off', // Playwright fixtures use `async ({}, use) => …`
    },
  },
  {
    files: ['tests/**/*.ts', 'pages/**/*.ts', 'flows/**/*.ts', 'fixtures/**/*.ts', 'setup/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expect*'] }],
      'playwright/no-conditional-in-test': 'warn',
    },
  },
  {
    // Setup / cleanup "tests" provision data; they have nothing to assert.
    files: ['setup/**/*.ts'],
    rules: { 'playwright/expect-expect': 'off', 'playwright/no-conditional-in-test': 'off' },
  },
  {
    // The Phase-0 crawler is exploratory tooling, not a test.
    files: ['discovery/**/*.ts'],
    rules: { 'playwright/no-networkidle': 'off', 'playwright/no-conditional-in-test': 'off' },
  }
);
