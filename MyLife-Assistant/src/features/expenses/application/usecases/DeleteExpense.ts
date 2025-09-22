import type { ExpenseId } from '@/features/expenses/domain/types'
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'
import { useExpensesStore } from '@/stores/expensesStore'

export async function deleteExpense(id: ExpenseId, repo: IExpenseRepository): Promise<boolean> {
  // 履歴保存
  useExpensesStore.getState().commit()
  const ok = await repo.delete(id)
  if (ok) {
    useExpensesStore.getState().remove(id)
  }
  return ok
}
