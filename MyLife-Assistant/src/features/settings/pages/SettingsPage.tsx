import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/stores/settingsStore'
import { updateSettings } from '@/features/settings/application/usecases/UpdateSettings'
import type { Settings } from '@/features/settings/domain/types'

const schema = z.object({
  monthStartDay: z.number().int().min(1).max(28),
  monthlyBudget: z.number().nonnegative(),
})
type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const s = useSettings()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      monthStartDay: s.monthStartDay,
      monthlyBudget: s.monthlyBudget,
    },
  })

  // ★ ユニークID
  const monthStartDayId = useId()
  const monthlyBudgetId = useId()

  const onSubmit = (values: FormValues) => {
    // Settings['monthStartDay'] がユニオン型の場合に備え最小限キャスト
    updateSettings({
      monthStartDay: values.monthStartDay as Settings['monthStartDay'],
      monthlyBudget: values.monthlyBudget,
    })
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24 grid gap-6">
      <h1 className="text-xl font-semibold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>家計設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-1.5">
              <Label htmlFor={monthStartDayId}>月の開始日（1〜28）</Label>
              <Input
                id={monthStartDayId}
                type="number"
                min={1}
                max={28}
                {...register('monthStartDay')}
              />
              {errors.monthStartDay && (
                <p className="text-sm text-destructive">{errors.monthStartDay.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={monthlyBudgetId}>月予算（円）</Label>
              <Input
                id={monthlyBudgetId}
                type="number"
                min={0}
                step="1"
                {...register('monthlyBudget')}
              />
              {errors.monthlyBudget && (
                <p className="text-sm text-destructive">{errors.monthlyBudget.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
