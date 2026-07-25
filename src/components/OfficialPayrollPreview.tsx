import { Link } from 'react-router-dom'
import type { PayPeriod, PaySlip } from '../lib/types'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { PaySlipDocument } from './PaySlipDocument'

interface OfficialPayrollPreviewProps {
  period: PayPeriod
  slips: PaySlip[]
}

export function OfficialPayrollPreview({ period, slips }: OfficialPayrollPreviewProps) {
  const totalGross = slips.reduce((sum, slip) => sum + slip.grossPay, 0)
  const totalHours = slips.reduce((sum, slip) => sum + slip.totalHours, 0)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-900">Official Payroll</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pay period: {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
        </p>
        {slips.length > 1 && (
          <p className="mt-3 text-sm text-slate-600">
            {slips.length} pay slips were issued for this period.
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

      {slips.map((slip) => (
        <div key={slip.id} className="space-y-2">
          <PaySlipDocument paySlip={slip} showActions={false} />
          <Link
            to={`/employee/pay-slips/${slip.id}`}
            className="inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Open full pay slip
          </Link>
        </div>
      ))}
    </div>
  )
}
