// src/features/expenses/application/usecases/ImportCsv.ts
import type { Expense } from '@/features/expenses/domain/types'
import { useExpensesStore } from '@/stores/expensesStore'
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'
import { parseExpensesCsv } from '@/lib/csv'

export async function importExpensesFromCsvText(
  csvText: string,
  repo: IExpenseRepository
): Promise<{ imported: Expense[]; errors: string[] }> {
  const { rows, errors } = parseExpensesCsv(csvText)
  // 履歴保存
  useExpensesStore.getState().commit()
  const created = await repo.addMany(rows)
  useExpensesStore.getState().addMany(created.map((c) => ({ ...c })))
  return { imported: created, errors }
}

export async function importExpensesFromFile(
  file: File,
  repo: IExpenseRepository
): Promise<{ imported: Expense[]; errors: string[] }> {
  const text = await file.text()
  return importExpensesFromCsvText(text, repo)
}
