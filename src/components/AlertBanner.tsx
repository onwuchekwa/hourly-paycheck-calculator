type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const styles: Record<AlertVariant, string> = {
  error: 'bg-red-50 text-red-800 border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

interface AlertBannerProps {
  variant?: AlertVariant
  children: React.ReactNode
  className?: string
}

export function AlertBanner({ variant = 'info', children, className = '' }: AlertBannerProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${styles[variant]} ${className}`}
    >
      {children}
    </div>
  )
}
