import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // This JavaScript codebase does not use runtime PropTypes. Prefer an eventual
      // TypeScript migration over duplicating the API response shapes in every component.
      'react/prop-types': 'off',
      // The legacy screens intentionally retain dormant UI/state branches that are
      // tree-shaken from production builds. Track their removal separately from lint.
      'no-unused-vars': 'off',
      // API cancellation and optional browser integrations intentionally ignore failures.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Existing callback lifecycles predate exhaustive-deps and changing them can alter
      // polling/subscription behavior. New code should still review dependencies manually.
      'react-hooks/exhaustive-deps': 'off',
      // The router intentionally exports route configuration alongside small components.
      'react-refresh/only-export-components': 'off',
      'react/jsx-no-target-blank': 'off',
    },
  },
]
