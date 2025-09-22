import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAllExpenses } from '@/stores/expensesStore'
import { useSettings } from '@/stores/settingsStore'
import { getBudgetPeriod, isWithin } from '@/lib/date'
import dayjs from 'dayjs'
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm'

export function DashboardPage() {
  const items = useAllExpenses()
  const { monthStartDay, monthlyBudget } = useSettings()

  const nowISO = dayjs().toISOString()
  const { start, end } = getBudgetPeriod(nowISO, monthStartDay)

  const inThisBudgetMonth = items
    .filter((e) => isWithin(e.date, start, end))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const total = inThisBudgetMonth.reduce((sum, e) => sum + e.amount, 0)
  const remaining = monthlyBudget - total
  const recent5 = inThisBudgetMonth.slice(0, 5)

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 grid gap-6">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

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
    </div>
  )
}
