import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ErrorBoundary() {
  const error = useRouteError()

  let errorMessage: string
  let errorStatus: string | number = 'Unknown Error'

  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText
    errorStatus = error.status
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else {
    errorMessage = 'An unexpected error occurred'
  }

  const handleReload = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-xl text-destructive">
            エラーが発生しました ({errorStatus})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="flex gap-2">
            <Button onClick={handleReload} variant="default">
              再読み込み
            </Button>
            <Button onClick={handleGoHome} variant="outline">
              ホームに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
