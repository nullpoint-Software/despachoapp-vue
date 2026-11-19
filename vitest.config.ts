import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { testTimeout: 15000, include: ['tests/unit/**/*.test.ts'] } })
