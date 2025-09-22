/**
 * MyLife Assistant のルーティング設定
 * React Router v6 の createBrowserRouter を使用
 * RootLayout で全ページ共通のレイアウト（フッターナビ）を提供
 */
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { AppFooterNav } from '@/components/common/AppFooterNav'
import { DashboardPage } from '@/features/expenses/pages/DashboardPage'
import { HistoryPage } from '@/features/expenses/pages/HistoryPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

/**
 * すべてのページの共通レイアウト（フッターナビを含む）
 * Outlet で子ルートのコンポーネントをレンダリング
 */
function RootLayout() {
  return (
    <>
      {/* メインコンテンツ - フッターナビの高さ分余白を確保 */}
      <div className="min-h-dvh pb-16">
        <Outlet />
      </div>

      {/* フッターナビゲーション - Router コンテキスト内で使用 */}
      <AppFooterNav />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])
