import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExpensesStore } from '@/stores/expensesStore'
import { useSettings } from '@/stores/settingsStore'
import { getBudgetPeriod, isWithin } from '@/lib/date'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const items = useExpensesStore((s) => s.items)
  const { monthStartDay, monthlyBudget } = useSettings()

  const nowISO = dayjs().toISOString()
  const range = useMemo(() => getBudgetPeriod(nowISO, monthStartDay), [nowISO, monthStartDay])
  const { start, end } = range
  const formatDateParam = (d: string) => dayjs(d).format('YYYY-MM-DD')
  const monthStartParam = formatDateParam(range.start)
  const monthEndParam = formatDateParam(range.end)

  const inThisBudgetMonth = items
    .filter((e) => isWithin(e.date, start, end))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const total = inThisBudgetMonth.reduce((sum, e) => sum + e.amount, 0)
  const remaining = monthlyBudget - total
  const recent5 = inThisBudgetMonth.slice(0, 5)

  // ---- Step 6-C: 予算進捗リング ----
  const progressRatio = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) return 0
    return Math.max(0, Math.min(1, total / monthlyBudget))
  }, [total, monthlyBudget])
  const progressPct = Math.round(progressRatio * 100)
  const ringAngle = Math.round(progressRatio * 360)
  const overBudget = total > monthlyBudget
  const ringColorClass =
    monthlyBudget <= 0
      ? 'text-muted-foreground'
      : overBudget
        ? 'text-red-500'
        : progressPct >= 80
          ? 'text-amber-500'
          : 'text-primary'

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

  // ---- Step 6-D: 曜日×週ミニヒートマップ用データ ----
  const recentWeeks = useMemo(() => {
    // 直近 8 週（今週含む）: 各週の月曜日（または日曜開始でもOK）を基準にする
    const startOfThisWeek = dayjs().startOf('week') // dayjs のデフォは日曜開始
    return Array.from({ length: 8 }, (_, i) => startOfThisWeek.subtract(7 - i, 'week'))
  }, [])

  const heatmapMatrix = useMemo(() => {
    // rows = 週（古い→新しい）, cols = 0..6（日→土）
    const matrix: number[][] = recentWeeks.map(() => Array(7).fill(0))
    for (const it of items) {
      const d = dayjs(it.date)
      // 属する「週の開始日」を検索
      const idx = recentWeeks.findIndex((w) => {
        const weekStart = w.startOf('week')
        const weekEnd = w.endOf('week')
        return d.isAfter(weekStart.subtract(1, 'ms')) && d.isBefore(weekEnd.add(1, 'ms'))
      })
      if (idx >= 0) {
        const wd = d.day() // 0=日〜6=土
        matrix[idx][wd] += it.amount
      }
    }
    return matrix
  }, [items, recentWeeks])

  const heatmapMax = useMemo(() => {
    const flat = heatmapMatrix.flat()
    const max = Math.max(0, ...flat)
    return max || 1 // 0割回避
  }, [heatmapMatrix])

  const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="py-4 pb-24 space-y-6">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

      {/* Step 6-C: 予算進捗 */}
      <Card>
        <CardHeader>
          <CardTitle>予算進捗</CardTitle>
        </CardHeader>
        <CardContent>
          <figure className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Ring */}
            <div className={`relative size-28 ${ringColorClass}`}>
              {/* 外側の円（グラデーション） */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage: `conic-gradient(currentColor ${ringAngle}deg, hsl(var(--muted)) 0deg)`,
                }}
                aria-hidden="true"
              />
              {/* 内側のくり抜き */}
              <div className="absolute inset-2 rounded-full bg-background" aria-hidden="true" />
              {/* 中央パーセント表示 */}
              <div className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums">
                {progressPct}%
              </div>
            </div>
            {/* テキスト説明 */}
            <figcaption className="space-y-1">
              <div className="text-sm text-muted-foreground">
                予算：¥{monthlyBudget.toLocaleString()}
              </div>
              <div className="text-sm">
                使った額：
                <span className="tabular-nums font-medium">¥{total.toLocaleString()}</span>
              </div>
              <div className="text-sm">
                進捗：<span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="text-sm">
                {overBudget ? (
                  <>
                    超過：
                    <span className="tabular-nums text-red-600 font-medium">
                      ¥{(total - monthlyBudget).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    残り：
                    <span className="tabular-nums font-medium">
                      ¥{(monthlyBudget - total).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
              {monthlyBudget <= 0 && (
                <div className="text-xs text-muted-foreground">
                  ※ 設定で月次予算を入力すると進捗が表示されます
                </div>
              )}
            </figcaption>
          </figure>
        </CardContent>
      </Card>

      {/* Step 6-B: 今月のハイライト */}
      <Card>
        <CardHeader>
          <CardTitle>今月のハイライト</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Link
              to={`/history?start=${monthStartParam}&end=${monthEndParam}`}
              aria-label="この期間の履歴へ"
              className="underline text-primary hover:opacity-80"
            >
              この期間の履歴へ
            </Link>
          </div>
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
                      className="h-3 rounded bg-primary transition-[width] duration-500 motion-reduce:transition-none"
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
              <caption className="sr-only">最近6か月の支出合計一覧</caption>
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
                  <caption className="sr-only">カテゴリ別の合計・件数・構成比</caption>
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
                          <td className="p-2 flex items-center gap-3">
                            <span>{pct}%</span>
                            <Link
                              to={`/history?start=${monthStartParam}&end=${monthEndParam}&category=${category}`}
                              aria-label={`${label} の履歴を見る`}
                              className="text-xs underline text-primary hover:opacity-80"
                            >
                              履歴
                            </Link>
                          </td>
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

      {/* Step 6-D: 曜日×週ミニヒートマップ */}
      <Card>
        <CardHeader>
          <CardTitle>曜日×週のミニヒートマップ（直近8週）</CardTitle>
        </CardHeader>
        <CardContent>
          {/* セマンティックな table で a11y 対応 */}
          <div className="overflow-x-auto">
            <table className="text-sm">
              <caption className="sr-only">直近8週間の曜日別支出ヒートマップ</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">週</th>
                  {weekdayLabels.map((w) => (
                    <th key={w} className="p-2 text-center">
                      {w}
                    </th>
                  ))}
                  <th className="p-2 text-right">合計</th>
                </tr>
              </thead>
              <tbody>
                {heatmapMatrix.map((row, r) => {
                  const weekStartDay = recentWeeks[r].startOf('week')
                  const weekEndDay = recentWeeks[r].endOf('week')
                  const weekStart = weekStartDay.format('MM/DD')
                  const weekEnd = weekEndDay.format('MM/DD')
                  const weekKey = `${weekStartDay.format('YYYY-MM-DD')}_${weekEndDay.format('YYYY-MM-DD')}`
                  const weekSum = row.reduce((a, b) => a + b, 0)
                  return (
                    <tr key={weekKey} className="border-t">
                      <td className="p-2 whitespace-nowrap">
                        {weekStart}–{weekEnd}
                      </td>
                      {row.map((v, c) => {
                        // 0〜100% 濃度（bg-primary の不透明度で擬似的に表現）
                        const ratio = Math.min(1, v / heatmapMax)
                        // hsl(var(--primary)) を使うと文字が見づらいので、枠＋背景で視認性を確保
                        return (
                          <td key={`${weekKey}_${weekdayLabels[c]}`} className="p-2">
                            <div
                              className="mx-auto h-6 w-6 rounded border"
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                opacity: ratio ? 0.25 + ratio * 0.65 : 0.08,
                              }}
                              title={`${weekdayLabels[c]}: ¥${v.toLocaleString()}`}
                              aria-hidden="true"
                            />
                            <span className="sr-only">
                              {`${weekStart}–${weekEnd} の ${weekdayLabels[c]}: ¥${v.toLocaleString()}`}
                            </span>
                          </td>
                        )
                      })}
                      <td className="p-2 text-right tabular-nums">¥{weekSum.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ※ 色は相対濃度（直近8週内の最大値基準）です。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
