import type { Category } from '@/features/expenses/domain/types'

export type RecurringId = string
export type RecurringCadence = 'monthly' | 'weekly'

export interface Recurring {
  id: RecurringId
  label: string
  amount: number
  category: Category
  cadence: RecurringCadence
  startAt: string // ISO
  endAt?: string // ISO
  // 将来の拡張用フィールドはここに追加
}

export interface RecurringDraft {
  id: string
  sourceId: RecurringId
  date: string // ISO（実際に登録される想定日）
  label: string
  amount: number
  category: Category
}
