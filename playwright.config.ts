import { defineConfig, devices } from '@playwright/test'

/** The e2e suite runs against the production build served by `vite preview`, Chromium only. */
const baseUrl = 'http://localhost:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: baseUrl, reuseExistingServer: true, timeout: 180000 },
  use: { baseURL: baseUrl },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
