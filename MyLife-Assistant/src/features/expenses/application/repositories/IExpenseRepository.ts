// ドメイン型
import type { Expense, ExpenseId } from '@/features/expenses/domain/types'

/**
 * アプリケーション層からデータ永続化の詳細を隠蔽するための I/F。
 * - ここでは Promise ベースの最小APIを定義（後でSupabase等にも差し替え可能）
 */
export interface IExpenseRepository {
  list(): Promise<Expense[]>
  get(id: ExpenseId): Promise<Expense | null>
  add(input: Omit<Expense, 'id'>): Promise<Expense>
  update(id: ExpenseId, patch: Partial<Omit<Expense, 'id'>>): Promise<Expense | null>
  delete(id: ExpenseId): Promise<boolean>

  /** CSV などから複数件まとめて投入する想定（重複は呼び出し側で調整） */
  addMany(items: Array<Omit<Expense, 'id'>>): Promise<Expense[]>
  /** エクスポート用途（そのままCSV化できる形で返す） */
  exportAll(): Promise<Expense[]>
}
