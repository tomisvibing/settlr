import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Catches a missing import after moving code between modules
      'no-undef': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['*.config.js'], languageOptions: { globals: { ...globals.node } } },
];
