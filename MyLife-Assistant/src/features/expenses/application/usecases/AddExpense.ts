// UI からはこの関数を呼ぶだけでOK：Repositoryに保存→Storeを同期
import type { Expense, ExpenseId } from '@/features/expenses/domain/types'
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'
import { useExpensesStore } from '@/stores/expensesStore'

export async function addExpense(
  input: Omit<Expense, 'id'>,
  repo: IExpenseRepository
): Promise<Expense> {
  // 1) 履歴保存
  useExpensesStore.getState().commit()
  // 2) 永続化
  const created = await repo.add(input)
  // 3) Store 同期（Repository で採番された id を使う）
  useExpensesStore.getState().add({ id: created.id as ExpenseId, ...input })
  return created
}
