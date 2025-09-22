/**
 * MyLife Assistant メインアプリケーションコンポーネント
 * ルーティングプロバイダを提供
 * レイアウト（フッターナビ）は RootLayout で管理
 */
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider'
import { router } from './routes'

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
