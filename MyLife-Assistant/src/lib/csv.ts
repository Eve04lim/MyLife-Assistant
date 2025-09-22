// src/lib/csv.ts
import Papa from 'papaparse'
import { z } from 'zod'
import type { Expense } from '@/features/expenses/domain/types'

// ヘッダ: date, category, amount, memo
export const CsvRowSchema = z.object({
  date: z.string().min(1, 'date is required'),
  category: z.enum(['food', 'rent', 'utilities', 'transport', 'other']),
  amount: z.coerce.number().nonnegative(),
  memo: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
})
export type CsvRow = z.infer<typeof CsvRowSchema>

export function parseExpensesCsv(text: string): {
  rows: Array<Omit<Expense, 'id'>>
  errors: string[]
} {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const rows: Array<Omit<Expense, 'id'>> = []
  const errors: string[] = []

  if (result.errors?.length) {
    for (const e of result.errors) errors.push(`CSV parse error: ${e.message}`)
  }

  for (const [idx, raw] of (result.data ?? []).entries()) {
    const parsed = CsvRowSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push(`Row ${idx + 1}: ${parsed.error.issues.map((i) => i.message).join(', ')}`)
      continue
    }
    rows.push(parsed.data)
  }

  return { rows, errors }
}

export function toExpensesCsv(rows: Expense[]): string {
  return Papa.unparse(rows, { columns: ['id', 'date', 'category', 'amount', 'memo'] })
}

export function addBom(text: string): string {
  return `\uFEFF${text}`
}

export function downloadTextAsFile(
  filename: string,
  text: string,
  mime = 'text/plain;charset=utf-8;'
) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
