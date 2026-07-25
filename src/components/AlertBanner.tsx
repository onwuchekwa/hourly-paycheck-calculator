type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const styles: Record<AlertVariant, string> = {
  error: 'border-l-4 border-l-red-500 bg-red-50 text-red-800 border-red-200',
  success: 'border-l-4 border-l-emerald-500 bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'border-l-4 border-l-amber-500 bg-amber-50 text-amber-900 border-amber-200',
  info: 'border-l-4 border-l-blue-500 bg-blue-50 text-blue-800 border-blue-200',
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
