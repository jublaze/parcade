import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.runtime/illuminate-final-browser-results',
  reporter: [['list'], ['json', { outputFile: '.runtime/illuminate-final-browser-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4191', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev -- --base / --host 127.0.0.1 --port 4191 --strictPort', url: 'http://127.0.0.1:4191', reuseExistingServer: false, stdout: 'ignore', stderr: 'pipe' },
});

