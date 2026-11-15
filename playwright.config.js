import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', timeout: 60000, use: { baseURL: 'http://127.0.0.1:3001', viewport: { width: 1440, height: 1100 } }, webServer: { command: 'npm start', url: 'http://127.0.0.1:3001/api/health', reuseExistingServer: true }, reporter: 'list' });
