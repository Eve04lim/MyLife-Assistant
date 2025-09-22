// src/lib/date.ts
import dayjs from 'dayjs'
import type { MonthStartDay } from '@/features/settings/domain/types'

/** 家計月の開始日から見た期間（start, end）を返す。end は開始日の前日 23:59:59.999。 */
export function getBudgetPeriod(dateISO: string, monthStartDay: MonthStartDay) {
  const d = dayjs(dateISO)
  const startThisMonth = d.date(monthStartDay)
  const start = d.date() >= monthStartDay ? startThisMonth : startThisMonth.subtract(1, 'month')
  const end = start.add(1, 'month').subtract(1, 'millisecond')
  return { start, end } // dayjs オブジェクト
}

/** 期間に含まれるか（両端含む） */
export function isWithin(dateISO: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const t = dayjs(dateISO)
  return (t.isAfter(start) || t.isSame(start)) && (t.isBefore(end) || t.isSame(end))
}

/** 当月（家計月）かどうか */
export function isInCurrentBudgetMonth(dateISO: string, monthStartDay: MonthStartDay) {
  const nowISO = dayjs().toISOString()
  const { start, end } = getBudgetPeriod(nowISO, monthStartDay)
  return isWithin(dateISO, start, end)
}
