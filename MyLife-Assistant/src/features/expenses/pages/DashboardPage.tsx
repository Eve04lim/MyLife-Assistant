import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExpensesStore } from '@/stores/expensesStore'
import { useSettings } from '@/stores/settingsStore'
import { getBudgetPeriod, isWithin } from '@/lib/date'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm'

export function DashboardPage() {
  const items = useExpensesStore((s) => s.items)
  const { monthStartDay, monthlyBudget } = useSettings()

  const nowISO = dayjs().toISOString()
  const { start, end } = getBudgetPeriod(nowISO, monthStartDay)

  const inThisBudgetMonth = items
    .filter((e) => isWithin(e.date, start, end))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const total = inThisBudgetMonth.reduce((sum, e) => sum + e.amount, 0)
  const remaining = monthlyBudget - total
  const recent5 = inThisBudgetMonth.slice(0, 5)

  // ---- Step 6-B: 「今月のハイライト」計算 ----
  // 前月の予算期間
  const prevMonthAnchor = useMemo(() => dayjs(nowISO).subtract(1, 'month').toISOString(), [nowISO])
  const prevRange = useMemo(
    () => getBudgetPeriod(prevMonthAnchor, monthStartDay),
    [prevMonthAnchor, monthStartDay]
  )
  const prevMonthItems = useMemo(
    () => items.filter((it) => isWithin(it.date, prevRange.start, prevRange.end)),
    [items, prevRange.start, prevRange.end]
  )
  const prevTotal = useMemo(
    () => prevMonthItems.reduce((acc, it) => acc + it.amount, 0),
    [prevMonthItems]
  )
  const momDeltaPct = useMemo(() => {
    if (prevTotal <= 0 && total <= 0) return 0
    if (prevTotal <= 0) return 100
    return Math.round(((total - prevTotal) / prevTotal) * 100)
  }, [total, prevTotal])

  // 今月トップカテゴリ
  const topCategory = useMemo(() => {
    const acc = new Map<string, number>()
    for (const it of inThisBudgetMonth) {
      acc.set(it.category, (acc.get(it.category) ?? 0) + it.amount)
    }
    let top: { category: string; total: number } | null = null
    for (const [cat, sum] of acc) {
      if (!top || sum > top.total) top = { category: cat, total: sum }
    }
    return top
  }, [inThisBudgetMonth])

  // 今月の最大支出
  const maxExpense = useMemo(() => {
    if (inThisBudgetMonth.length === 0) return null
    return inThisBudgetMonth.reduce((a, b) => (a.amount >= b.amount ? a : b))
  }, [inThisBudgetMonth])

  // 今月の平均支出（1レコードあたり）
  const avgExpense = useMemo(() => {
    if (inThisBudgetMonth.length === 0) return 0
    return Math.round(total / inThisBudgetMonth.length)
  }, [total, inThisBudgetMonth.length])

  const categoryLabels: Record<string, string> = {
    food: '食費',
    rent: '家賃',
    utilities: '光熱費',
    transport: '交通',
    other: 'その他',
  }

  // 最近6か月のキー(YYYY-MM)を新しい順に
  const recentMonths = useMemo(() => {
    const base = dayjs().startOf('month')
    return Array.from({ length: 6 }, (_, i) =>
      base.subtract(i, 'month').format('YYYY-MM')
    ).reverse()
  }, [])

  // 月次合計 { 'YYYY-MM': number }
  const monthlyTotals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of recentMonths) map[m] = 0
    for (const it of items) {
      const ym = dayjs(it.date).format('YYYY-MM')
      if (ym in map) map[ym] += it.amount
    }
    return map
  }, [items, recentMonths])

  const maxMonthly = useMemo(() => {
    const vals = Object.values(monthlyTotals)
    return Math.max(1, ...vals)
  }, [monthlyTotals])

  // カテゴリ別集計
  const categorySummary = useMemo(() => {
    const sum: Record<string, { total: number; count: number }> = {}
    for (const it of items) {
      if (!sum[it.category]) sum[it.category] = { total: 0, count: 0 }
      sum[it.category].total += it.amount
      sum[it.category].count += 1
    }
    return sum
  }, [items])

  const grandTotal = useMemo(() => items.reduce((acc, it) => acc + it.amount, 0), [items])

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 space-y-6">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

      {/* Step 6-B: 今月のハイライト */}
      <Card>
        <CardHeader>
          <CardTitle>今月のハイライト</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">今月合計</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                ¥{total.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                レコード: {inThisBudgetMonth.length} 件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">前月比</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {momDeltaPct >= 0 ? '+' : ''}
                {momDeltaPct}%
              </div>
              <div className="text-xs text-muted-foreground">
                前月: ¥{prevTotal.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">トップカテゴリ</div>
              <div className="mt-1 text-lg font-semibold">
                {topCategory ? (categoryLabels[topCategory.category] ?? topCategory.category) : '—'}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {topCategory ? `¥${topCategory.total.toLocaleString()}` : '—'}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">最大支出 / 平均</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {maxExpense ? `¥${maxExpense.amount.toLocaleString()}` : '—'}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                平均: {avgExpense > 0 ? `¥${avgExpense.toLocaleString()}` : '—'}
              </div>
            </div>
          </div>
          {/* 最大支出の詳細（任意表示） */}
          {maxExpense && (
            <div className="mt-3 text-sm text-muted-foreground">
              最大支出の詳細: {dayjs(maxExpense.date).format('YYYY/MM/DD')}・
              {categoryLabels[maxExpense.category] ?? maxExpense.category}・ ¥
              {maxExpense.amount.toLocaleString()}
              {maxExpense.memo ? `・${maxExpense.memo}` : ''}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">今月の支出合計</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{total.toLocaleString()} 円</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">今月の予算</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {monthlyBudget.toLocaleString()} 円
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">予算残額</CardTitle>
          </CardHeader>
          <CardContent className={`text-2xl font-bold ${remaining < 0 ? 'text-destructive' : ''}`}>
            {remaining.toLocaleString()} 円
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>支出を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>直近5件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {recent5.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだデータがありません</p>
          ) : (
            <ul className="space-y-2">
              {recent5.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {dayjs(e.date).format('MM/DD')}・{e.category}
                    {e.memo ? `・${e.memo}` : ''}
                  </span>
                  <span className="font-medium">{e.amount.toLocaleString()} 円</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 最近6か月の推移 */}
      <Card>
        <CardHeader>
          <CardTitle>最近6か月の推移</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 棒グラフ（CSS幅） */}
          <fieldset className="space-y-2">
            <legend className="sr-only">最近6か月の支出推移</legend>
            {recentMonths.map((ym) => {
              const v = monthlyTotals[ym] ?? 0
              const widthPct = Math.round((v / maxMonthly) * 100)
              return (
                <div key={ym} className="flex items-center gap-2">
                  <div className="w-24 tabular-nums text-sm text-muted-foreground">{ym}</div>
                  <div className="h-3 flex-1 rounded bg-muted/70">
                    <div
                      className="h-3 rounded bg-primary"
                      style={{ width: `${widthPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="w-28 text-right tabular-nums">¥{v.toLocaleString()}</div>
                  {/* スクリーンリーダー向け説明 */}
                  <span className="sr-only">{`${ym} の支出合計は ¥${v.toLocaleString()}`}</span>
                </div>
              )
            })}
          </fieldset>

          {/* テーブル（視覚/詳細確認用） */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">月</th>
                  <th className="p-2">合計</th>
                </tr>
              </thead>
              <tbody>
                {recentMonths.map((ym) => {
                  const v = monthlyTotals[ym] ?? 0
                  return (
                    <tr key={ym} className="border-t">
                      <td className="p-2">{ym}</td>
                      <td className="p-2">¥{v.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* カテゴリ別内訳 */}
      <Card>
        <CardHeader>
          <CardTitle>カテゴリ別内訳</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(categorySummary).length === 0 ? (
            <p className="text-sm text-muted-foreground">データがありません</p>
          ) : (
            <>
              {/* バッジ群 */}
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(categorySummary).map(([category, { total, count }]) => {
                  const label = categoryLabels[category] || category
                  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
                  return (
                    <div
                      key={category}
                      className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">
                        ¥{total.toLocaleString()} / {count}件 / {pct}%
                      </span>
                      {/* 必要なら読み上げを補強 */}
                      <span className="sr-only">
                        {`${label}: 合計 ¥${total.toLocaleString()}、${count}件、全体の ${pct}%`}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="p-2">カテゴリ</th>
                      <th className="p-2">合計</th>
                      <th className="p-2">件数</th>
                      <th className="p-2">構成比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categorySummary).map(([category, { total, count }]) => {
                      const label = categoryLabels[category] || category
                      const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
                      return (
                        <tr key={category} className="border-t">
                          <td className="p-2">{label}</td>
                          <td className="p-2">¥{total.toLocaleString()}</td>
                          <td className="p-2">{count}</td>
                          <td className="p-2">{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="p-2">合計</td>
                      <td className="p-2">¥{grandTotal.toLocaleString()}</td>
                      <td className="p-2">{items.length}</td>
                      <td className="p-2">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
