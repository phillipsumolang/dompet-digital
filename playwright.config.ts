import { defineConfig, devices } from '@playwright/test'

/**
 * Mobile layout smoke tests, in WebKit.
 *
 * The unit suite covers the maths; this covers the thing that actually broke
 * twice -- layout that renders correctly in Chromium and wrongly on a phone.
 * WebKit is the point of it, so there is only the one project.
 *
 * It runs against the production build, not the dev server, because that is
 * what ships.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
