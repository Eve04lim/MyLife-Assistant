import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2Eテスト設定ファイル
 * MyLife Assistant アプリケーション用の設定
 */
export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',
  
  // 各テストのタイムアウト（30秒）
  timeout: 30 * 1000,
  
  // テスト実行時の設定
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // レポート形式
  reporter: 'html',
  
  // 全テスト共通設定
  use: {
    // ベースURL（開発サーバー）
    baseURL: 'http://localhost:5173',
    
    // 失敗時にスクリーンショットを取得
    screenshot: 'only-on-failure',
    
    // 失敗時にビデオを記録
    video: 'retain-on-failure',
  },

  // テスト対象ブラウザ設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // 開発サーバーの自動起動設定
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})