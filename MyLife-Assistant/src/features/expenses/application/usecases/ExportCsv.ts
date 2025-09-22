// src/features/expenses/application/usecases/ExportCsv.ts
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'
import { toExpensesCsv, downloadTextAsFile, addBom } from '@/lib/csv'

export async function exportExpensesToCsv(repo: IExpenseRepository): Promise<string> {
  const rows = await repo.exportAll()
  return toExpensesCsv(rows)
}

export async function exportExpensesToCsvWithOptions(
  repo: IExpenseRepository,
  opts?: { bom?: boolean }
): Promise<string> {
  const text = await exportExpensesToCsv(repo)
  return opts?.bom ? addBom(text) : text
}

export async function triggerDownloadCsv(filename: string, csvText: string) {
  downloadTextAsFile(filename, csvText, 'text/csv;charset=utf-8;')
}
