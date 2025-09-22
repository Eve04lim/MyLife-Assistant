import type { Expense, ExpenseId } from '@/features/expenses/domain/types'
import type { IExpenseRepository } from '@/features/expenses/application/repositories/IExpenseRepository'

const STORAGE_KEY = 'mylife.expenses.v1'

function maybeRandomUUID(): string | undefined {
  // globalThis に crypto があり、randomUUID が関数ならそれを使う
  if (typeof globalThis === 'object' && globalThis !== null && 'crypto' in globalThis) {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  }
  return undefined
}

function generateId(): ExpenseId {
  const uuid = maybeRandomUUID()
  return uuid ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function readAll(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Expense[]) : []
  } catch {
    // 破損していた場合は安全側で空配列を返す
    return []
  }
}

function writeAll(items: Expense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export class LocalStorageExpenseRepository implements IExpenseRepository {
  async list(): Promise<Expense[]> {
    return readAll()
  }

  async get(id: ExpenseId): Promise<Expense | null> {
    const all = readAll()
    return all.find((e) => e.id === id) ?? null
  }

  async add(input: Omit<Expense, 'id'>): Promise<Expense> {
    const all = readAll()
    const created: Expense = { id: generateId(), ...input }
    all.push(created)
    writeAll(all)
    return created
  }

  async update(id: ExpenseId, patch: Partial<Omit<Expense, 'id'>>): Promise<Expense | null> {
    const all = readAll()
    const idx = all.findIndex((e) => e.id === id)
    if (idx === -1) return null
    const updated: Expense = { ...all[idx], ...patch }
    all[idx] = updated
    writeAll(all)
    return updated
  }

  async delete(id: ExpenseId): Promise<boolean> {
    const all = readAll()
    const next = all.filter((e) => e.id !== id)
    if (next.length === all.length) return false
    writeAll(next)
    return true
  }

  async addMany(items: Array<Omit<Expense, 'id'>>): Promise<Expense[]> {
    const all = readAll()
    const created = items.map((i) => ({ id: generateId(), ...i }))
    writeAll([...all, ...created])
    return created
  }

  async exportAll(): Promise<Expense[]> {
    return readAll()
  }
}
