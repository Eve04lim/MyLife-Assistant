import { test, expect } from '@playwright/test'

/**
 * MyLife Assistant のサンプルE2Eテスト
 * トップページの基本的な動作を確認
 */

test.describe('MyLife Assistant - トップページ', () => {
  test('ページが正常に読み込まれる', async ({ page }) => {
    // トップページにアクセス
    await page.goto('/')
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/Vite \+ React \+ TS/)
  })

  test('ボタンが表示される', async ({ page }) => {
    await page.goto('/')
    
    // "Click me" ボタンが表示されることを確認
    const clickButton = page.getByRole('button', { name: 'Click me' })
    await expect(clickButton).toBeVisible()
    
    // "Secondary" ボタンが表示されることを確認
    const secondaryButton = page.getByRole('button', { name: 'Secondary' })
    await expect(secondaryButton).toBeVisible()
  })

  test('ボタンをクリックできる', async ({ page }) => {
    await page.goto('/')
    
    // "Click me" ボタンをクリック
    const clickButton = page.getByRole('button', { name: 'Click me' })
    await clickButton.click()
    
    // ボタンが引き続き存在することを確認（基本的な動作確認）
    await expect(clickButton).toBeVisible()
  })
})