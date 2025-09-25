/**
 * MyLife Assistant のルーティング設定
 * React Router v6 の createBrowserRouter を使用
 * RootLayout で全ページ共通のレイアウト（フッターナビ）を提供
 */
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { useId } from 'react'
import { AppFooterNav } from '@/components/common/AppFooterNav'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { DashboardPage } from '@/features/expenses/pages/DashboardPage'
import { HistoryPage } from '@/features/expenses/pages/HistoryPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'

/**
 * すべてのページの共通レイアウト（フッターナビを含む）
 * Outlet で子ルートのコンポーネントをレンダリング
 */
function RootLayout() {
  const mainId = useId()
  return (
    <>
      {/* 追加: スキップリンク */}
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        メインコンテンツへスキップ
      </a>

      {/* メインコンテンツ - フッターナビの高さ分余白を確保 */}
      <div className="min-h-dvh pb-16">
        <main id={mainId} className="mx-auto max-w-5xl px-4">
          <Outlet />
        </main>
      </div>

      {/* フッターナビゲーション - Router コンテキスト内で使用 */}
      <AppFooterNav />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])
