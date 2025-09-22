/**
 * モバイルファーストのフッターナビゲーション
 * 画面下部に固定表示、3つのメインページへのナビゲーションを提供
 * アクセシビリティ（aria-current, sr-only）に配慮した実装
 */

import { Home, List, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

// ナビゲーションアイテムの定義
const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/history', label: 'History', icon: List },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppFooterNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <li key={to} className="flex">
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center justify-center gap-2 px-4 py-3 text-sm transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
