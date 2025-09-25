import { useToast } from './use-toast'
import { Toast, ToastTitle, ToastDescription } from './toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <output
      aria-live="polite"
      className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    >
      {toasts.map(({ id, title, description, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="grid gap-1">
            {title ? <ToastTitle>{title}</ToastTitle> : null}
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </div>
        </Toast>
      ))}
    </output>
  )
}
