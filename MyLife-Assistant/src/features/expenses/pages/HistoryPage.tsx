import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useExpensesStore } from '@/stores/expensesStore'
import { shallow } from 'zustand/shallow'
import { useSearchParams } from 'react-router-dom'
import { deleteExpense } from '@/features/expenses/application/usecases/DeleteExpense'
import { importExpensesFromFile } from '@/features/expenses/application/usecases/ImportCsv'
import { exportExpensesToCsvWithOptions } from '@/features/expenses/application/usecases/ExportCsv'
import { toExpensesCsvFromView, downloadTextAsFile, addBom } from '@/lib/csv'
import { expenseRepo } from '@/features/expenses/infra/repositories/singleton'
import dayjs from 'dayjs'
import type { Category } from '@/features/expenses/domain/types'

export function HistoryPage() {
  // items は shallow 比較で購読
  const items = useExpensesStore((s) => s.items, shallow)
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  // ---- Step 5-L 追加: 履歴操作 ----
  // 関数参照(undo/redo)には購読をぶら下げない：購読は boolean のみ
  const canUndo = useExpensesStore((s) => s.canUndo)
  const canRedo = useExpensesStore((s) => s.canRedo)
  const undo = () => useExpensesStore.getState().undo()
  const redo = () => useExpensesStore.getState().redo()

  // ---- Step 5-I 追加: 検索/並び替え/UI 状態 ----
  type SortKey = 'date' | 'amount'
  type SortOrder = 'asc' | 'desc'

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc') // 既定：日付の新しい順

  // ---- Step 5-J 追加: 高度フィルタ状態 ----
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  // ---- Step 5-K 追加: ページング状態 ----
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // ---- Step 5-M 追加: BOM オプション状態 ----
  const [exportWithBom, setExportWithBom] = useState(false)

  // ---- Step 5-N 追加: カテゴリ絞り込み状態 ----
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set())

  // ---- Step 6-E: URLクエリ -> 初期状態への反映（start, end, category）----
  // 直前に URL から適用した値を覚えておき、searchParams 変化時のみ・差分があるときだけ反映する
  const appliedFromRef = useRef<string | null>(null)
  const appliedToRef = useRef<string | null>(null)
  const appliedCatsRef = useRef<string | null>(null) // 正規化後の "a,b,c"

  useEffect(() => {
    const start = searchParams.get('start') ?? ''
    const end = searchParams.get('end') ?? ''
    const catRaw = searchParams.get('category') ?? ''
    const catNorm = catRaw
      ? catRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
          .join(',')
      : ''

    let changed = false
    if (start && start !== appliedFromRef.current) {
      setDateFrom(start)
      appliedFromRef.current = start
      changed = true
    }
    if (end && end !== appliedToRef.current) {
      setDateTo(end)
      appliedToRef.current = end
      changed = true
    }
    if (catNorm && catNorm !== appliedCatsRef.current) {
      setSelectedCategories(new Set(catNorm.split(',') as Category[]))
      appliedCatsRef.current = catNorm
      changed = true
    }
    if (changed) setPage(1)
  }, [searchParams])

  const queryInputId = useId()
  const sortKeyId = useId()
  const sortOrderId = useId()
  const fileInputId = useId()
  const summaryHeadingId = useId() // a11y: サマリ見出しID
  const dateFromId = useId()
  const dateToId = useId()
  const amountMinId = useId()
  const amountMaxId = useId()
  const paginationInfoId = useId()
  const bomCheckboxId = useId()
  const categoryFilterId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ImportCsv の簡易型ガード（errors?: string[] 想定）
  const hasErrors = (v: unknown): v is { errors: string[] } => {
    return typeof v === 'object' && v !== null && Array.isArray((v as { errors?: unknown }).errors)
  }

  // 入力遅延（300ms）
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [query])

  // フィルタ → 並び替え（テキスト検索 + 日付範囲 + 金額範囲）
  const viewItems = useMemo(() => {
    // Step 1: テキスト検索
    const textFiltered = !debouncedQuery
      ? items
      : items.filter((it) => {
          const memo = (it.memo ?? '').toLowerCase()
          const category = (it.category ?? '').toLowerCase()
          const dateStr = dayjs(it.date).format('YYYY-MM-DD').toLowerCase()
          const amountStr = String(it.amount).toLowerCase()
          return (
            memo.includes(debouncedQuery) ||
            category.includes(debouncedQuery) ||
            dateStr.includes(debouncedQuery) ||
            amountStr.includes(debouncedQuery)
          )
        })

    // Step 2: 日付範囲フィルタ
    const dateFiltered = textFiltered.filter((it) => {
      const itemDate = dayjs(it.date)
      let withinRange = true

      if (dateFrom) {
        const fromDate = dayjs(dateFrom).startOf('day')
        if (itemDate.isBefore(fromDate)) {
          withinRange = false
        }
      }

      if (dateTo && withinRange) {
        const toDate = dayjs(dateTo).endOf('day')
        if (itemDate.isAfter(toDate)) {
          withinRange = false
        }
      }

      return withinRange
    })

    // Step 3: 金額範囲フィルタ
    const amountFiltered = dateFiltered.filter((it) => {
      const minValue = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY
      const maxValue = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY
      return it.amount >= minValue && it.amount <= maxValue
    })

    // Step 4: カテゴリ絞り込みフィルタ
    const categoryFiltered = amountFiltered.filter((it) => {
      // selectedCategories.size === 0 の場合は全カテゴリ対象
      return selectedCategories.size === 0 || selectedCategories.has(it.category)
    })

    // Step 5: 並び替え
    const sorted = [...categoryFiltered].sort((a, b) => {
      if (sortKey === 'date') {
        const av = new Date(a.date).getTime()
        const bv = new Date(b.date).getTime()
        return sortOrder === 'asc' ? av - bv : bv - av
      } else {
        const av = a.amount
        const bv = b.amount
        return sortOrder === 'asc' ? av - bv : bv - av
      }
    })
    return sorted
  }, [
    items,
    debouncedQuery,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    selectedCategories,
    sortKey,
    sortOrder,
  ])

  // ---- Step 5-J: カテゴリ別サマリ集計 ----
  const categorySummary = useMemo(() => {
    const summary: Record<string, { total: number; count: number }> = {}

    viewItems.forEach((item) => {
      const category = item.category
      if (!summary[category]) {
        summary[category] = { total: 0, count: 0 }
      }
      summary[category].total += item.amount
      summary[category].count += 1
    })

    return summary
  }, [viewItems])

  // ---- Step 5-K: ページング用のアイテム計算（クランプ方式で副作用レス）----
  const totalPages = Math.max(1, Math.ceil(viewItems.length / PAGE_SIZE))
  const currentPage = useMemo(() => {
    // page が総ページ数を超えた場合でも安全に表示できるようクランプ
    return Math.min(Math.max(1, page), totalPages)
  }, [page, totalPages])
  const pagedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return viewItems.slice(startIndex, startIndex + PAGE_SIZE)
  }, [viewItems, currentPage])

  // キーボードナビゲーション（左右キーでページング）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      )
        return

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setPage(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setPage(currentPage + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentPage, totalPages])

  // CSV インポート
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importExpensesFromFile(file, expenseRepo)
      // 期待インターフェース：{ errors?: string[] } を想定（なければ無視）
      if (result && hasErrors(result) && result.errors.length > 0) {
        toast({
          title: 'CSVインポートエラー',
          description: result.errors.join(', '),
          variant: 'destructive',
        })
      }
      // 取り込み後は store が同期更新される想定（ユースケース → Repository → Store）
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast({
        title: 'CSVインポート失敗',
        description: message,
        variant: 'destructive',
      })
    } finally {
      // 同じファイルを連続選択できるようにリセット
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // CSV エクスポート
  const handleExport = async () => {
    try {
      const csvText = await exportExpensesToCsvWithOptions(expenseRepo, { bom: exportWithBom })
      downloadTextAsFile('expenses.csv', csvText, 'text/csv;charset=utf-8;')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast({
        title: 'CSVエクスポート失敗',
        description: message,
        variant: 'destructive',
      })
    }
  }

  // 絞り込み結果のCSVエクスポート
  const handleExportFiltered = () => {
    try {
      const text = toExpensesCsvFromView(viewItems)
      const finalText = exportWithBom ? addBom(text) : text
      const today = dayjs().format('YYYYMMDD')
      downloadTextAsFile(`expenses_filtered_${today}.csv`, finalText, 'text/csv;charset=utf-8;')
      toast({ title: 'エクスポート完了', description: `絞り込み ${viewItems.length} 件` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast({ title: 'エクスポート失敗', description: message, variant: 'destructive' })
    }
  }

  const onDelete = async (id: string) => {
    await deleteExpense(id, expenseRepo)
  }

  return (
    <div className="py-4 pb-24 grid gap-6">
      <h1 className="text-xl font-semibold">履歴</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">検索・並び替え・CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 検索 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor={queryInputId}>フィルタ（メモ/カテゴリ/日付/金額）</Label>
              <Input
                id={queryInputId}
                placeholder="例: 食費 / 2025-09 / 1200 など"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="履歴検索入力"
              />
            </div>
            {/* 並び替え：キー */}
            <div className="sm:w-40">
              <Label htmlFor={sortKeyId}>並び替え</Label>
              <select
                id={sortKeyId}
                className="w-full border rounded-md h-9 px-2"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="並び替えキー"
              >
                <option value="date">日付</option>
                <option value="amount">金額</option>
              </select>
            </div>
            {/* 並び替え：順序 */}
            <div className="sm:w-36">
              <Label htmlFor={sortOrderId}>順序</Label>
              <select
                id={sortOrderId}
                className="w-full border rounded-md h-9 px-2"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                aria-label="並び替え順序"
              >
                <option value="desc">降順（新しい/高い → 古い/低い）</option>
                <option value="asc">昇順（古い/低い → 新しい/高い）</option>
              </select>
            </div>
          </div>

          {/* Step 5-J: 高度フィルタ（日付範囲 + 金額範囲） */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {/* 日付範囲 */}
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={dateFromId}>日付（開始）</Label>
                  <Input
                    id={dateFromId}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="日付範囲の開始日"
                  />
                </div>
                <div>
                  <Label htmlFor={dateToId}>日付（終了）</Label>
                  <Input
                    id={dateToId}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="日付範囲の終了日"
                  />
                </div>
              </div>
            </div>
            {/* 金額範囲 */}
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={amountMinId}>金額（最小）</Label>
                  <Input
                    id={amountMinId}
                    type="number"
                    min={0}
                    step="1"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    aria-label="金額範囲の最小値"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor={amountMaxId}>金額（最大）</Label>
                  <Input
                    id={amountMaxId}
                    type="number"
                    min={0}
                    step="1"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    aria-label="金額範囲の最大値"
                    placeholder="上限なし"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 5-N: カテゴリ絞り込み */}
          <div className="flex flex-col gap-2">
            <Label htmlFor={categoryFilterId}>カテゴリ絞り込み</Label>
            <div className="flex flex-wrap gap-2" id={categoryFilterId}>
              {/* すべてボタン */}
              <Button
                type="button"
                size="sm"
                variant={selectedCategories.size === 0 ? 'secondary' : 'outline'}
                className="focus-visible:ring-2 focus-visible:ring-offset-2"
                onClick={() => setSelectedCategories(new Set())}
                aria-pressed={selectedCategories.size === 0}
                aria-label="すべてのカテゴリを表示"
              >
                すべて
              </Button>
              {/* 各カテゴリボタン */}
              {(['food', 'rent', 'utilities', 'transport', 'other'] as const).map((category) => {
                const categoryLabels: Record<Category, string> = {
                  food: '食費',
                  rent: '家賃',
                  utilities: '光熱費',
                  transport: '交通',
                  other: 'その他',
                }
                const displayName = categoryLabels[category]
                const isSelected = selectedCategories.has(category)

                return (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={isSelected ? 'secondary' : 'outline'}
                    className="focus-visible:ring-2 focus-visible:ring-offset-2"
                    onClick={() => {
                      const newSelected = new Set(selectedCategories)
                      if (isSelected) {
                        newSelected.delete(category)
                      } else {
                        newSelected.add(category)
                      }
                      setSelectedCategories(newSelected)
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${displayName}カテゴリを${isSelected ? '除外' : '選択'}`}
                  >
                    {displayName}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* CSV */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex gap-2">
                <Button type="button" onClick={handleExport} aria-label="CSVエクスポート">
                  エクスポート（CSV）
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportFiltered}
                  aria-label="絞り込み結果をCSVでエクスポート"
                >
                  絞り込み結果をエクスポート
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id={fileInputId}
                  onChange={handleImportFileChange}
                />
                <Label htmlFor={fileInputId}>
                  <Button type="button" variant="secondary" asChild aria-label="CSVインポート">
                    <span>インポート（CSV）</span>
                  </Button>
                </Label>
              </div>
              {/* Step 5-M: BOM オプション */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={bomCheckboxId}
                  checked={exportWithBom}
                  onChange={(e) => setExportWithBom(e.target.checked)}
                  className="rounded border border-input"
                />
                <Label htmlFor={bomCheckboxId} className="text-sm">
                  Excel互換（BOMを付与）
                </Label>
              </div>
              {/* Step 5-L: Undo/Redo ボタン */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canUndo}
                  onClick={undo}
                  aria-label="元に戻す"
                >
                  元に戻す
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canRedo}
                  onClick={redo}
                  aria-label="やり直す"
                >
                  やり直す
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              件数: <span aria-live="polite">{viewItems.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>すべての支出</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {/* Step 5-J: カテゴリ別サマリバッジ */}
          {Object.keys(categorySummary).length > 0 && (
            <section className="mb-4" aria-labelledby={summaryHeadingId}>
              {/* スクリーンリーダー向け見出し */}
              <h2 id={summaryHeadingId} className="sr-only">
                カテゴリ別サマリ
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Object.entries(categorySummary).map(([category, { total, count }]) => {
                  const categoryLabels: Record<Category, string> = {
                    food: '食費',
                    rent: '家賃',
                    utilities: '光熱費',
                    transport: '交通',
                    other: 'その他',
                  }
                  const displayName = categoryLabels[category as Category] || category

                  return (
                    <div
                      key={category}
                      className="flex-shrink-0 bg-muted rounded-md px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{displayName}</div>
                      <div className="text-muted-foreground">
                        ¥{total.toLocaleString()} / {count}件
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {viewItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当する履歴がありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">日付</th>
                  <th className="p-2">カテゴリ</th>
                  <th className="p-2">金額</th>
                  <th className="p-2">メモ</th>
                  <th className="p-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{dayjs(e.date).format('YYYY/MM/DD')}</td>
                    <td className="p-2">{e.category}</td>
                    <td className="p-2">{e.amount.toLocaleString()} 円</td>
                    <td className="p-2">{e.memo ?? ''}</td>
                    <td className="p-2 text-right">
                      <Button variant="secondary" onClick={() => onDelete(e.id)}>
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Step 5-K: ページング UI */}
          {viewItems.length >= PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="前のページへ"
              >
                &lt; 前ページ
              </Button>
              <div
                id={paginationInfoId}
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                ページ {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="次のページへ"
              >
                次ページ &gt;
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
