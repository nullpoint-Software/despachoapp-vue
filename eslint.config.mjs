import { builtinModules } from 'node:module'
import javascript from '@eslint/js'
import typescript from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

const restrictedImports = [...builtinModules, 'electron', 'node:*', 'better-sqlite3', 'mysql2', 'mysql2/*']
/** Las capas de presentación y contratos no pueden importar capacidades privilegiadas. */
export default [
  { ignores: ['node_modules/**', 'dist/**','out/**', 'release/**', '.tools/**', 'docs/**', 'test-results/**', 'video/**'] },
  javascript.configs.recommended,
  ...typescript.configs.recommended,
  ...vue.configs['flat/recommended'],
  // El análisis JS no ve referencias en templates; vue-tsc comprueba esos usos.
  { files: ['**/*.vue'], rules: { 'no-undef': 'off', 'no-useless-assignment': 'off' }, languageOptions: { parserOptions: { parser: typescript.parser } } },
  { files: ['src/**/*.{ts,vue}', 'shared/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: restrictedImports }] } },
  // 8.1: estos dos archivos hacen criptografía y hashes (AES y SHA-256) y sólo los importan Main y el Host, nunca el Renderer.
  { files: ['shared/legacyMigration/legacyPasswordCheck.ts', 'shared/legacyMigration/legacySnapshot.ts'], rules: { 'no-restricted-imports': 'off' } },
  { files: ['src/App.vue'], rules: { 'vue/multi-word-component-names': 'off' } }
]



