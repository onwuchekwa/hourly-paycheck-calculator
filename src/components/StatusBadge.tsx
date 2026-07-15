import type { TimeEntryStatus, PayrollRunStatus, PayPeriodStatus } from '../lib/types'
import { classNames } from '../lib/utils'

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  submitted: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
  open: 'bg-blue-50 text-blue-800 ring-blue-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  preview: 'bg-violet-50 text-violet-800 ring-violet-200',
  finalized: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

interface StatusBadgeProps {
  status: TimeEntryStatus | PayrollRunStatus | PayPeriodStatus | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset',
        style,
        className,
      )}
    >
      {status}
    </span>
  )
}
