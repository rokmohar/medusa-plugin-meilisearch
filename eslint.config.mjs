import tseslint from 'typescript-eslint'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'

export default tseslint.config(
  {
    ignores: ['.medusa/**', '**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  },
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      'unused-imports': unusedImportsPlugin,
    },
    rules: {
      // TypeScript rules (disabled)
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'error',
      //'@typescript-eslint/no-floating-promises': 'error',
      //'@typescript-eslint/no-misused-promises': 'error',
      //'@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      //'@typescript-eslint/no-unsafe-argument': 'error',
      //'@typescript-eslint/no-unsafe-assignment': 'error',
      //'@typescript-eslint/no-unsafe-call': 'error',
      //'@typescript-eslint/no-unsafe-member-access': 'error',
      //'@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-await': 'error',
      //'@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

      // Unused imports rules
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],

      // Require braces for all control-flow bodies
      curly: ['error', 'all'],

      // Equality rules
      eqeqeq: ['error', 'always'],

      // Style rules
      'arrow-body-style': ['error', 'always'],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: ['const', 'let'] },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.unit.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
    },
  },
)
