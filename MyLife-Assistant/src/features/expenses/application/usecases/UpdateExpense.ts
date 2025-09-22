import type { Expense, ExpenseId } from '@/features/expenses/domain/types'
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'
import { useExpensesStore } from '@/stores/expensesStore'

export async function updateExpense(
  id: ExpenseId,
  patch: Partial<Omit<Expense, 'id'>>,
  repo: IExpenseRepository
): Promise<Expense | null> {
  // 履歴保存
  useExpensesStore.getState().commit()
  const updated = await repo.update(id, patch)
  if (updated) {
    useExpensesStore.getState().update(id, patch)
  }
  return updated
}
