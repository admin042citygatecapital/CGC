import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default [
  {
    ignores: ['dist', 'node_modules', '.next', '.vite', 'dev-tools', 'airo-secrets', 'content-plugin'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLTableSectionElement: 'readonly',
        HTMLTableRowElement: 'readonly',
        HTMLTableCellElement: 'readonly',
        HTMLTableCaptionElement: 'readonly',
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'no-unsanitized': noUnsanitized,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...noUnsanitized.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      // TypeScript (via tsc/type-check) already catches genuinely undefined
      // identifiers, including ambient DOM/Node/Vitest globals (fetch,
      // setTimeout, AbortController, URLSearchParams, crypto, require, vi,
      // describe, etc.) declared in lib.dom.d.ts / @types/node / vitest's
      // injected globals. ESLint's core no-undef rule doesn't see those
      // ambient declarations and produces false positives — this is why
      // typescript-eslint's own docs recommend turning it off for TS files.
      'no-undef': 'off',
      // Same rationale: TypeScript keeps types and values in separate
      // namespaces, so `interface Foo` + `function Foo` (e.g. a component
      // co-named with its props type) is valid declaration merging, not a
      // redeclaration. The base JS rule doesn't know that distinction.
      'no-redeclare': 'off',
    },
  },
];
