import { Link } from 'react-router-dom'
import type { PaySlip } from '../lib/types'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { PaySlipDocument } from './PaySlipDocument'

interface OfficialPayrollPreviewProps {
  slips: PaySlip[]
  startDate: string
  endDate: string
}

export function OfficialPayrollPreview({ slips, startDate, endDate }: OfficialPayrollPreviewProps) {
  const totalGross = slips.reduce((sum, slip) => sum + slip.grossPay, 0)
  const totalHours = slips.reduce((sum, slip) => sum + slip.totalHours, 0)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-900">Official Payroll</h2>
        <p className="mt-1 text-sm text-slate-600">
          {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
        </p>
        {slips.length > 1 && (
          <p className="mt-3 text-sm text-slate-600">
            {slips.length} pay slips match this date range.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Total Hours</dt>
            <dd className="font-medium">{formatDecimalHours(totalHours)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total Gross</dt>
            <dd className="font-medium text-brand-700">{formatCurrency(totalGross)}</dd>
          </div>
        </dl>
      </div>

      {slips.map((slip) => {
        const isPartialRange =
          slip.payPeriodStart !== startDate || slip.payPeriodEnd !== endDate

        return (
          <div key={slip.id} className="space-y-2">
            {isPartialRange && (
              <p className="text-sm text-slate-600">
                Pay slip {slip.paySlipNumber} covers{' '}
                {formatDisplayDate(slip.payPeriodStart)} – {formatDisplayDate(slip.payPeriodEnd)}.
                Showing only days within your selected range.
              </p>
            )}
            <PaySlipDocument paySlip={slip} showActions={false} />
            <Link
              to={`/employee/pay-slips/${slip.id}`}
              className="inline-block text-sm font-medium text-brand-600 hover:underline"
            >
              Open full pay slip
            </Link>
          </div>
        )
      })}
    </div>
  )
}
