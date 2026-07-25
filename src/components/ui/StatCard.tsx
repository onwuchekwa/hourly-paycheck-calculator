import type { ReactNode } from 'react'
import { classNames } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  accent?: 'default' | 'brand' | 'warning'
  className?: string
}

const accentStyles = {
  default: 'text-slate-900',
  brand: 'text-brand-700',
  warning: 'text-amber-700',
}

export function StatCard({ label, value, accent = 'default', className }: StatCardProps) {
  return (
    <div className={classNames('card', className)}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={classNames('mt-2 text-2xl font-bold tracking-tight sm:text-3xl', accentStyles[accent])}>
        {value}
      </p>
    </div>
  )
}
