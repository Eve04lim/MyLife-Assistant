import { create } from 'zustand'
import dayjs from 'dayjs'
import type { Recurring, RecurringDraft } from '@/features/recurrings/domain/types'
import { useExpensesStore } from '@/stores/expensesStore'

// 依存レスなID生成（対応環境では crypto.randomUUID を使用）
const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

type State = {
  recurrings: Recurring[]
  drafts: RecurringDraft[]
}

type Actions = {
  addRecurring: (r: Omit<Recurring, 'id'>) => void
  removeRecurring: (id: string) => void
  clearDraftsForMonth: (yyyymm: string) => void
  generateDraftsForRange: (startISO: string, endISO: string) => void
  applyDrafts: () => void
}

export const useRecurringStore = create<State & Actions>((set, get) => ({
  recurrings: [],
  drafts: [],

  addRecurring: (r) =>
    set((s) => ({
      recurrings: [...s.recurrings, { ...r, id: genId() }],
    })),

  removeRecurring: (id) =>
    set((s) => ({
      recurrings: s.recurrings.filter((x) => x.id !== id),
    })),

  clearDraftsForMonth: (yyyymm) =>
    set((s) => ({
      drafts: s.drafts.filter((d) => dayjs(d.date).format('YYYYMM') !== yyyymm),
    })),

  generateDraftsForRange: (startISO, endISO) => {
    const start = dayjs(startISO)
    const end = dayjs(endISO)
    const yyyymm = start.format('YYYYMM')
    const { recurrings } = get()

    // 既存の同月ドラフトは一旦消す
    get().clearDraftsForMonth(yyyymm)

    const inRange: RecurringDraft[] = []
    for (const r of recurrings) {
      // 有効期間チェック
      const rStart = dayjs(r.startAt)
      const rEnd = r.endAt ? dayjs(r.endAt) : null
      if (start.isBefore(rStart)) {
        // 期間より前ならスキップ（開始月以降に作る）
        continue
      }
      if (rEnd && start.isAfter(rEnd)) continue

      if (r.cadence === 'monthly') {
        // 月初の適用日: 予算月の開始日に揃える
        const date = start.startOf('day').toISOString()
        inRange.push({
          id: genId(),
          sourceId: r.id,
          date,
          label: r.label,
          amount: r.amount,
          category: r.category,
        })
      } else if (r.cadence === 'weekly') {
        // 週ごと: 期間内の各週の同曜日（開始日の曜日基準）
        let cursor = start.startOf('day')
        while (cursor.isBefore(end)) {
          inRange.push({
            id: genId(),
            sourceId: r.id,
            date: cursor.toISOString(),
            label: r.label,
            amount: r.amount,
            category: r.category,
          })
          cursor = cursor.add(7, 'day')
        }
      }
    }

    set((s) => ({ drafts: [...s.drafts, ...inRange] }))
  },

  applyDrafts: () => {
    const { drafts } = get()
    if (drafts.length === 0) return
    // 既存の addMany を使って、一括登録
    useExpensesStore.getState().addMany(
      drafts.map((d) => ({
        id: genId(),
        date: d.date,
        amount: d.amount,
        category: d.category,
        memo: d.label,
      }))
    )
    // コミット（履歴管理している場合）
    useExpensesStore.getState().commit?.()
    // ドラフトを全消し
    set({ drafts: [] })
  },
}))
