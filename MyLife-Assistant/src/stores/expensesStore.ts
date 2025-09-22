import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Expense, ExpenseId } from '@/features/expenses/domain/types'

type ExpensesState = {
  items: Expense[]
}

type ExpensesActions = {
  add: (input: Omit<Expense, 'id'> & { id?: ExpenseId }) => void
  update: (id: ExpenseId, patch: Partial<Omit<Expense, 'id'>>) => void
  remove: (id: ExpenseId) => void
  addMany: (list: Array<Omit<Expense, 'id'> & { id?: ExpenseId }>) => void
  setAll: (list: Expense[]) => void
  clear: () => void
}

export type ExpensesStore = ExpensesState & ExpensesActions

const STORAGE_KEY = 'mla:expenses:v1'

// ID 生成（Repository と揃えた振る舞い）
function maybeRandomUUID(): string | undefined {
  if (typeof globalThis === 'object' && globalThis && 'crypto' in globalThis) {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  }
  return undefined
}
function genId(): ExpenseId {
  return maybeRandomUUID() ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const useExpensesStore = create<ExpensesStore>()(
  persist(
    immer((set) => ({
      items: [],

      add: (input) =>
        set((s) => {
          const id = input.id ?? genId()
          s.items.push({
            id,
            date: input.date,
            category: input.category,
            amount: input.amount,
            memo: input.memo,
          })
        }),

      update: (id, patch) =>
        set((s) => {
          const t = s.items.find((e) => e.id === id)
          if (t) Object.assign(t, patch)
        }),

      remove: (id) =>
        set((s) => {
          s.items = s.items.filter((e) => e.id !== id)
        }),

      addMany: (list) =>
        set((s) => {
          const toAdd = list.map((i) => ({ id: i.id ?? genId(), ...i }))
          s.items.push(...toAdd)
        }),

      setAll: (list) =>
        set((s) => {
          s.items = list
        }),

      clear: () =>
        set((s) => {
          s.items = []
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // v5 の persist は state 型推論を崩さないのでこのままでOK
      version: 1,
    }
  )
)

// 便利なセレクターフック
export const useAllExpenses = () => useExpensesStore((s) => s.items)
export const useExpenseById = (id: ExpenseId) =>
  useExpensesStore((s) => s.items.find((e) => e.id === id))
