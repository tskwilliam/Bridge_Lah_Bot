import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true },
  projects: [{ name: 'phone-390', use: { viewport: { width: 390, height: 844 } } }, { name: 'phone-430', use: { viewport: { width: 430, height: 932 } } }],
});
