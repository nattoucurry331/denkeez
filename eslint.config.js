// ESLint v9 flat config
// CLAUDE.md L82: any 原則禁止 / L88: 1 ファイル 300 行以内
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'src-tauri/target', 'coverage'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // React 17+ JSX transform では React import 不要
      'react/react-in-jsx-scope': 'off',
      // CLAUDE.md L82
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // CLAUDE.md §1.6 ログ規約 (PII を出さないため warn 中心)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // CLAUDE.md §7 保守性: 早期リターン推奨
      'no-else-return': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // テストでは any や console を許容
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
