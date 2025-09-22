// 支出ドメインの型定義（最小から始めて、後で拡張）
export type ExpenseId = string

// 最初は固定カテゴリ。将来ユーザー定義カテゴリに拡張しやすいよう文字列Unionで設計
export type Category = 'food' | 'rent' | 'utilities' | 'transport' | 'other'

/**
 * Expense
 * - date: ISO文字列（YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ）
 * - amount: 0以上の数値（検証はUseCase層で行う）
 */
export interface Expense {
  id: ExpenseId
  date: string
  category: Category
  amount: number
  memo?: string
}
