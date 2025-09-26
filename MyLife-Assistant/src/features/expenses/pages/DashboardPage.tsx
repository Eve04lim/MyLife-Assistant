import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExpensesStore } from '@/stores/expensesStore'
import { useSettings } from '@/stores/settingsStore'
import { getBudgetPeriod, isWithin } from '@/lib/date'
import dayjs from 'dayjs'
import { useMemo, useState, useId, useRef, useEffect } from 'react'
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm'
import { CategoryTrends } from '@/features/expenses/components/CategoryTrends'
import { Link } from 'react-router-dom'
import { exportElementToPng, printElement } from '@/lib/export'
import { useRecurringStore } from '@/stores/recurringStore'
import type { RecurringCadence } from '@/features/recurrings/domain/types'
import type { Category } from '@/features/expenses/domain/types'
import { useToast } from '@/components/ui/use-toast'

export function DashboardPage() {
  const items = useExpensesStore((s) => s.items)
  const { monthStartDay, monthlyBudget } = useSettings()
  const [reportOpen, setReportOpen] = useState(false)
  const reportRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const { drafts, recurrings, addRecurring, removeRecurring, generateDraftsForRange, applyDrafts } =
    useRecurringStore()

  // Step 8-2: Modal用の固有ID生成
  const uid = useId()
  const dialogId = `monthly-report-${uid}`
  const headingId = `monthly-report-heading-${uid}`
  const descId = `monthly-report-desc-${uid}`

  const nowISO = dayjs().toISOString()
  const range = useMemo(() => getBudgetPeriod(nowISO, monthStartDay), [nowISO, monthStartDay])
  const { start, end } = range
  const formatDateParam = (d: string) => dayjs(d).format('YYYY-MM-DD')
  const monthStartParam = formatDateParam(range.start.toISOString())
  const monthEndParam = formatDateParam(range.end.toISOString())

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

  // ---- Step 8-1: バーンレート計算 ----
  const monthStartDate = range.start.toDate()
  const monthEndDate = range.end.toDate()
  const MS_PER_DAY = 86_400_000

  // 期間日数（開始含む/終了は境界日扱いなので日数としては end-start）
  const periodDays = Math.max(
    Math.round((monthEndDate.getTime() - monthStartDate.getTime()) / MS_PER_DAY),
    1
  )

  // 今日を [start, end) にクランプして経過日数を算出（少なくとも1日）
  const now = new Date()
  const clampedNow = new Date(
    Math.min(Math.max(now.getTime(), monthStartDate.getTime()), monthEndDate.getTime() - 1)
  )
  const elapsedDays = Math.min(
    Math.max(Math.floor((clampedNow.getTime() - monthStartDate.getTime()) / MS_PER_DAY) + 1, 1),
    periodDays
  )
  const remainingDays = Math.max(periodDays - elapsedDays, 0)

  // 残額（マイナスなら超過）
  const remainingAmount = monthlyBudget - total

  // バーンレート
  const idealDaily = monthlyBudget / periodDays
  const actualDaily = total / elapsedDays
  const dailyDelta = actualDaily - idealDaily // +:使い過ぎペース, -:節約ペース

  // 残り日数で均等に使う場合の「必要/目安 1日あたり」
  const neededDaily = remainingDays > 0 ? remainingAmount / remainingDays : 0

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

  // 今月トップカテゴリ（reportCategorySummaryから取得するため削除）

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

  // ---- Step 8-2: 月次サマリーレポート用データ ----
  const reportCategorySummary = useMemo(() => {
    const categoryLabels: Record<string, string> = {
      food: '食費',
      rent: '家賃',
      utilities: '光熱費',
      transport: '交通',
      other: 'その他',
    }
    return Object.entries(categorySummary)
      .map(([category, { total, count }]) => ({
        category,
        label: categoryLabels[category] || category,
        total,
        count,
      }))
      .sort((a, b) => b.total - a.total)
  }, [categorySummary])

  const monthTotalCount = useMemo(
    () => reportCategorySummary.reduce((a, c) => a + c.count, 0),
    [reportCategorySummary]
  )
  const monthTotalAmount = useMemo(
    () => reportCategorySummary.reduce((a, c) => a + c.total, 0),
    [reportCategorySummary]
  )
  const averageAmount = monthTotalCount ? Math.round(monthTotalAmount / monthTotalCount) : 0
  const topCategory = reportCategorySummary[0] ?? null

  // ドーナツ図の conic-gradient CSS を作成
  const donutStyle = useMemo(() => {
    const total = monthTotalAmount || 1
    let acc = 0
    const slices = reportCategorySummary.map((c, i) => {
      const from = (acc / total) * 360
      acc += c.total
      const to = (acc / total) * 360
      const hue = 210 + ((i * 35) % 120) // ちょいバリエーション
      return `hsl(${hue} 80% 55%) ${from}deg ${to}deg`
    })
    const bg = slices.length
      ? `conic-gradient(${slices.join(', ')})`
      : `conic-gradient(var(--color-muted) 0deg 360deg)`
    return { backgroundImage: bg }
  }, [reportCategorySummary, monthTotalAmount])

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

  // ---- Step 9-2: ショートカットキー ----
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || el.isContentEditable || tag === 'select'
    }
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      // 修飾キー押下時は無効
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // 入力中は無効（? も含めて全て無効）
      if (isTypingTarget(e.target)) return

      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        // 新規入力フォームへフォーカス（存在すれば日付→金額の順で試す）
        const form = document.querySelector('[data-expense-form]') as HTMLFormElement | null
        const focusables = ['input[name="date"]', 'input[name="amount"]', 'select[name="category"]']
        for (const sel of focusables) {
          const el = form?.querySelector<HTMLInputElement | HTMLSelectElement>(sel)
          if (el) {
            el.focus()
            break
          }
        }
        return
      }
      if (k === 'g') {
        e.preventDefault()
        const section = document.querySelector('[data-section="category-trends"]')
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (k === 'r') {
        e.preventDefault()
        setReportOpen(true)
        return
      }
      if (k === '?') {
        e.preventDefault()
        toast({
          title: 'ショートカット',
          description: 'n: 新規入力 / g: カテゴリ分析へ / r: 月次レポート / ?: ヘルプ',
          duration: 4000,
        })
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toast])

  return (
    <div className="py-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">ダッシュボード</h1>
        <button
          type="button"
          className="text-sm underline text-primary hover:opacity-80"
          onClick={() => setReportOpen(true)}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-keyshortcuts="r"
        >
          月次レポート
        </button>
      </div>

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
                {remainingAmount >= 0 ? (
                  <>
                    残額：
                    <span className="tabular-nums font-medium">
                      ¥{remainingAmount.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    超過：
                    <span className="tabular-nums text-red-600 font-medium">
                      ¥{Math.abs(remainingAmount).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
              {/* Step 8-1: バーンレート行群 */}
              <div className="mt-1 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                <div>
                  1日あたり目安：
                  <span className="tabular-nums">¥{Math.round(idealDaily).toLocaleString()}</span>
                </div>
                <div>
                  これまでの実績：
                  <span className="tabular-nums">¥{Math.round(actualDaily).toLocaleString()}</span>
                  <span className={dailyDelta >= 0 ? 'text-red-600 ml-1' : 'text-emerald-600 ml-1'}>
                    ({dailyDelta >= 0 ? '+' : '−'}¥
                    {Math.abs(Math.round(dailyDelta)).toLocaleString()}/日)
                  </span>
                </div>
                <div>
                  残り日数：<span className="tabular-nums">{remainingDays}</span> 日
                </div>
                <div>
                  残りの目安：
                  <span className="tabular-nums">
                    ¥{Math.max(0, Math.round(neededDaily)).toLocaleString()}
                  </span>{' '}
                  /日
                </div>
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
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">今月合計</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                ¥{total.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                レコード: {inThisBudgetMonth.length} 件
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">前月比</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {momDeltaPct >= 0 ? '+' : ''}
                {momDeltaPct}%
              </div>
              <div className="text-xs text-muted-foreground">
                前月: ¥{prevTotal.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">トップカテゴリ</div>
              <div className="mt-1 text-lg font-semibold">
                {topCategory ? topCategory.label : '—'}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {topCategory ? `¥${topCategory.total.toLocaleString()}` : '—'}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
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
                              className="mx-auto h-6 w-6 rounded border border-border"
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

      {/* Step 9: 定期支出（スケルトン） */}
      <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">定期支出（β）</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
              onClick={() =>
                generateDraftsForRange(range.start.toISOString(), range.end.toISOString())
              }
            >
              今月分の下書きを作成
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-60"
              disabled={drafts.length === 0}
              onClick={() => applyDrafts()}
            >
              下書きを一括反映
            </button>
          </div>
        </div>

        {/* 追加フォーム（超軽量） */}
        <details className="mb-3">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            定期支出を追加
          </summary>
          <form
            className="mt-2 grid gap-2 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget as HTMLFormElement)
              const label = String(fd.get('label') || '')
              const amount = Number(fd.get('amount') || 0)
              const category = String(fd.get('category') || 'other') as Category
              const cadence = String(fd.get('cadence') || 'monthly') as RecurringCadence
              const startAt = String(fd.get('startAt') || dayjs().toISOString())
              if (!label || !amount) return
              addRecurring({ label, amount, category, cadence, startAt })
              ;(e.currentTarget as HTMLFormElement).reset()
            }}
          >
            <input
              name="label"
              placeholder="ラベル（例: 家賃）"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            />
            <input
              name="amount"
              type="number"
              min="0"
              placeholder="金額"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            />
            <select
              name="category"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="rent">家賃</option>
              <option value="food">食費</option>
              <option value="utilities">光熱費</option>
              <option value="transport">交通</option>
              <option value="other">その他</option>
            </select>
            <select
              name="cadence"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="monthly">毎月</option>
              <option value="weekly">毎週</option>
            </select>
            <input
              name="startAt"
              type="date"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            />
            <div className="sm:col-span-5">
              <button
                type="submit"
                className="mt-1 h-8 rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                追加
              </button>
            </div>
          </form>
        </details>

        {/* 登録済みの定期支出 */}
        <div className="grid gap-2">
          {recurrings.length === 0 ? (
            <p className="text-sm text-muted-foreground">登録された定期支出はありません。</p>
          ) : (
            recurrings.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-border p-2 text-sm"
              >
                <div className="truncate">
                  {r.label}（{r.cadence === 'monthly' ? '毎月' : '毎週'} / {r.category}）
                </div>
                <div className="tabular-nums">¥{r.amount.toLocaleString()}</div>
                <button
                  type="button"
                  className="h-7 rounded-md border border-border px-2 text-xs hover:bg-muted"
                  onClick={() => removeRecurring(r.id)}
                >
                  削除
                </button>
              </div>
            ))
          )}
        </div>

        {/* 今月の下書き一覧 */}
        <div className="mt-3">
          <div className="text-xs text-muted-foreground mb-1">
            今月の下書き（{drafts.length}件）
          </div>
          <div className="grid gap-1">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                下書きはありません。「今月分の下書きを作成」を押してください。
              </p>
            ) : (
              drafts.map((d) => (
                <div
                  key={d.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <div className="tabular-nums">{dayjs(d.date).format('MM/DD')}</div>
                  <div className="truncate">
                    {d.label}（{d.category}）
                  </div>
                  <div className="tabular-nums">¥{d.amount.toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Step 8-3: カテゴリ分析 */}
      <CategoryTrends />

      {/* Step 8-2: 月次サマリーレポートモーダル */}
      {reportOpen && (
        <div
          role="dialog"
          id={dialogId}
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={descId}
          className="fixed inset-0 z-50 grid place-items-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setReportOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={reportRef}
            className="relative z-10 w-full max-w-xl rounded-xl bg-card ring-1 ring-border shadow-lg p-4"
          >
            <div className="flex items-start justify-between">
              <h2 id={headingId} className="text-lg font-semibold text-primary">
                月次サマリーレポート
              </h2>
              <button
                type="button"
                className="text-sm underline text-muted-foreground hover:text-foreground"
                onClick={() => setReportOpen(false)}
              >
                閉じる
              </button>
            </div>

            <p id={descId} className="mt-2 text-sm text-muted-foreground">
              今月の支出サマリーとカテゴリ内訳を確認できます。
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col items-center gap-3">
                <div className="relative size-36">
                  <div className="absolute inset-0 rounded-full" style={donutStyle} />
                  <div className="absolute inset-4 rounded-full bg-background" />
                  <div className="absolute inset-0 grid place-items-center text-sm">
                    <div className="text-center">
                      <div className="tabular-nums font-semibold">
                        ¥{monthTotalAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">今月合計</div>
                    </div>
                  </div>
                </div>
                <figcaption className="text-xs text-muted-foreground">カテゴリ構成比</figcaption>
              </figure>

              <div className="grid gap-2 text-sm">
                <div>
                  件数：<span className="tabular-nums">{monthTotalCount}</span> 件
                </div>
                <div>
                  平均：<span className="tabular-nums">¥{averageAmount.toLocaleString()}</span> /件
                </div>
                {topCategory && (
                  <div>
                    トップカテゴリ：<span className="font-medium">{topCategory.label}</span>（
                    <span className="tabular-nums">¥{topCategory.total.toLocaleString()}</span>）
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">カテゴリ別の合計・件数・構成比</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2">カテゴリ</th>
                    <th className="p-2">合計</th>
                    <th className="p-2">件数</th>
                    <th className="p-2">比率</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCategorySummary.map((c) => {
                    const ratio = monthTotalAmount
                      ? Math.round((c.total / monthTotalAmount) * 100)
                      : 0
                    return (
                      <tr key={c.category} className="border-t">
                        <td className="p-2">{c.label}</td>
                        <td className="p-2 tabular-nums">¥{c.total.toLocaleString()}</td>
                        <td className="p-2 tabular-nums">{c.count}</td>
                        <td className="p-2 tabular-nums">{ratio}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() =>
                  reportRef.current && exportElementToPng(reportRef.current, 'monthly-report.png')
                }
              >
                PNG保存
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() => reportRef.current && printElement(reportRef.current)}
              >
                印刷
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() => setReportOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
