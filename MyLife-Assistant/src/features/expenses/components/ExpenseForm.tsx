import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category } from '@/features/expenses/domain/types'
import { addExpense } from '@/features/expenses/application/usecases/AddExpense'
import { expenseRepo } from '@/features/expenses/infra/repositories/singleton'

const schema = z.object({
  date: z.string().min(1, '必須'),
  category: z.enum(['food', 'rent', 'utilities', 'transport', 'other']),
  amount: z.coerce.number().nonnegative('0以上'),
  memo: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const CATEGORY_LABELS: Record<Category, string> = {
  food: '食費',
  rent: '家賃',
  utilities: '光熱費',
  transport: '交通',
  other: 'その他',
}

export function ExpenseForm({ onAdded }: { onAdded?: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: 'food',
      amount: 0,
      memo: '',
    },
  })

  // ★ ここでユニークIDを生成
  const dateId = useId()
  const categoryId = useId()
  const amountId = useId()
  const memoId = useId()

  const onSubmit = async (values: FormValues) => {
    await addExpense(values, expenseRepo)
    reset({ ...values, amount: 0, memo: '' })
    onAdded?.()
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-1.5">
        <Label htmlFor={dateId}>日付</Label>
        <Input id={dateId} type="date" {...register('date')} />
        {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={categoryId}>カテゴリ</Label>
        <select
          id={categoryId}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          {...register('category')}
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={amountId}>金額</Label>
        <Input
          id={amountId}
          type="number"
          min={0}
          step="1"
          {...register('amount', { valueAsNumber: true })}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={memoId}>メモ（任意）</Label>
        <Input id={memoId} type="text" {...register('memo')} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          追加
        </Button>
      </div>
    </form>
  )
}
