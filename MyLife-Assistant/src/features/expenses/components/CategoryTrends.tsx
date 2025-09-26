import { useState, useMemo, useId, useRef } from 'react'
import { useExpensesStore } from '@/stores/expensesStore'
import { useSettings } from '@/stores/settingsStore'
import { getBudgetPeriod, isWithin } from '@/lib/date'
import dayjs from 'dayjs'
import { exportElementToPng, printElement } from '@/lib/export'

interface BarChartData {
  label: string
  value: number
}

interface BarChartProps {
  data: BarChartData[]
  className?: string
}

function BarChart({ data, className = '' }: BarChartProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item, index) => {
        const widthPct = Math.round((item.value / maxValue) * 100)
        return (
          <div
            key={`${item.label}-${index}`}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3"
          >
            <div className="truncate text-sm text-muted-foreground" title={item.label}>
              {item.label}
            </div>
            <div className="h-6 rounded bg-muted/70 relative">
              <div
                className="h-6 rounded bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(widthPct, 8)}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="text-right text-sm tabular-nums">¥{item.value.toLocaleString()}</div>
          </div>
        )
      })}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
      )}
    </div>
  )
}

function useCategoryAnalytics(
  items: Array<{ date: string; amount: number; category: string }>,
  range: { start: string; end: string }
) {
  const monthlyData = useMemo(() => {
    const categoryMap: Record<string, number> = {}
    const categoryLabels: Record<string, string> = {
      food: '食費',
      rent: '家賃',
      utilities: '光熱費',
      transport: '交通',
      other: 'その他',
    }

    items
      .filter((item) => isWithin(item.date, dayjs(range.start), dayjs(range.end)))
      .forEach((item) => {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount
      })

    return Object.entries(categoryMap)
      .map(([category, amount]) => ({
        label: categoryLabels[category] || category,
        value: amount,
        category,
      }))
      .sort((a, b) => b.value - a.value)
  }, [items, range.start, range.end])

  const useWeeklyTrend = (selectedCategory: string) => {
    return useMemo(() => {
      if (!selectedCategory) return []

      const startDate = dayjs(range.start)
      const endDate = dayjs(range.end)
      const weeks: Array<{ label: string; value: number }> = []

      let currentWeekStart = startDate
      let weekIndex = 1

      while (currentWeekStart.isBefore(endDate)) {
        const weekEnd = currentWeekStart.add(6, 'day')
        const actualWeekEnd = weekEnd.isAfter(endDate) ? endDate : weekEnd

        const weekAmount = items
          .filter(
            (item) =>
              item.category === selectedCategory &&
              dayjs(item.date).isAfter(currentWeekStart.subtract(1, 'day')) &&
              dayjs(item.date).isBefore(actualWeekEnd.add(1, 'day'))
          )
          .reduce((sum, item) => sum + item.amount, 0)

        weeks.push({
          label: `W${weekIndex}`,
          value: weekAmount,
        })

        currentWeekStart = weekEnd.add(1, 'day')
        weekIndex++
      }

      return weeks
    }, [selectedCategory, items, range.start, range.end])
  }

  const topCategory = monthlyData[0]?.category || ''

  return { monthlyData, useWeeklyTrend, topCategory }
}

export function CategoryTrends() {
  const items = useExpensesStore((s) => s.items)
  const { monthStartDay } = useSettings()
  const [activeTab, setActiveTab] = useState<'monthly' | 'weekly'>('monthly')
  const [selectedCategory, setSelectedCategory] = useState('')
  const sectionRef = useRef<HTMLElement | null>(null)

  const uid = useId()
  const tablistId = `category-trends-tablist-${uid}`
  const monthlyPanelId = `monthly-panel-${uid}`
  const weeklyPanelId = `weekly-panel-${uid}`

  const nowISO = dayjs().toISOString()
  const range = useMemo(() => getBudgetPeriod(nowISO, monthStartDay), [nowISO, monthStartDay])

  const stringRange = {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  }
  const { monthlyData, useWeeklyTrend, topCategory } = useCategoryAnalytics(items, stringRange)

  // 初期選択カテゴリを設定
  if (!selectedCategory && topCategory) {
    setSelectedCategory(topCategory)
  }

  const weeklyData = useWeeklyTrend(selectedCategory)

  const categoryLabels: Record<string, string> = {
    food: '食費',
    rent: '家賃',
    utilities: '光熱費',
    transport: '交通',
    other: 'その他',
  }

  const availableCategories = monthlyData.map((item) => item.category)

  return (
    <section
      ref={sectionRef}
      data-section="category-trends"
      className="rounded-xl border border-border bg-card p-3 sm:p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary">
          カテゴリ分析 <span className="ml-2 text-xs text-muted-foreground">(g)</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
            onClick={() => {
              if (sectionRef.current) exportElementToPng(sectionRef.current, 'category-trends.png')
            }}
          >
            PNG保存
          </button>
          <button
            type="button"
            className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
            onClick={() => {
              if (sectionRef.current) printElement(sectionRef.current)
            }}
          >
            印刷
          </button>
        </div>
      </div>

      {/* タブ */}
      <div role="tablist" id={tablistId} className="flex space-x-1 rounded-lg bg-muted p-1 mb-4">
        <button
          type="button"
          role="tab"
          id={`tab-monthly-${uid}`}
          aria-selected={activeTab === 'monthly'}
          aria-controls={monthlyPanelId}
          tabIndex={activeTab === 'monthly' ? 0 : -1}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 ring-offset-2 ring-border ${
            activeTab === 'monthly'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('monthly')}
        >
          月間カテゴリ別
        </button>
        <button
          type="button"
          role="tab"
          id={`tab-weekly-${uid}`}
          aria-selected={activeTab === 'weekly'}
          aria-controls={weeklyPanelId}
          tabIndex={activeTab === 'weekly' ? 0 : -1}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 ring-offset-2 ring-border ${
            activeTab === 'weekly'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('weekly')}
        >
          週別推移
        </button>
      </div>

      {/* 月間カテゴリ別タブ */}
      {activeTab === 'monthly' && (
        <div
          role="tabpanel"
          id={monthlyPanelId}
          aria-labelledby={`tab-monthly-${uid}`}
          className="rounded-lg border border-border bg-background p-3"
        >
          <BarChart data={monthlyData.map((item) => ({ label: item.label, value: item.value }))} />
        </div>
      )}

      {/* 週別推移タブ */}
      {activeTab === 'weekly' && (
        <div
          role="tabpanel"
          id={weeklyPanelId}
          aria-labelledby={`tab-weekly-${uid}`}
          className="space-y-3"
        >
          {/* カテゴリ選択 */}
          <div>
            <label
              htmlFor={`category-select-${uid}`}
              className="block text-sm font-medium text-foreground mb-2"
            >
              カテゴリを選択
            </label>
            <select
              id={`category-select-${uid}`}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="カテゴリを選択"
            >
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category] || category}
                </option>
              ))}
            </select>
            <span className="sr-only" aria-live="polite">
              {selectedCategory
                ? `選択中: ${categoryLabels[selectedCategory] || selectedCategory}`
                : 'カテゴリを選択してください'}
            </span>
          </div>

          {/* 週別グラフ */}
          <div className="rounded-lg border border-border bg-background p-3">
            <BarChart data={weeklyData} />
          </div>
        </div>
      )}
    </section>
  )
}
