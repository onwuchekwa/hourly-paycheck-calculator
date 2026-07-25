import { Link } from 'react-router-dom'
import type { PayPeriod, PaySlip } from '../lib/types'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { PaySlipDocument } from './PaySlipDocument'

interface OfficialPayrollPreviewProps {
  period: PayPeriod
  slip: PaySlip
  sourceSlips?: PaySlip[]
}

export function OfficialPayrollPreview({ period, slip, sourceSlips = [] }: OfficialPayrollPreviewProps) {
  const individualSlips = sourceSlips.length > 0 ? sourceSlips : [slip]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-900">Official Payroll</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pay period: {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Employee</dt>
            <dd className="font-medium">{slip.employeeName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Rate</dt>
            <dd className="font-medium">{formatCurrency(slip.hourlyRate)}/hr</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total Hours</dt>
            <dd className="font-medium">{formatDecimalHours(slip.totalHours)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total Gross</dt>
            <dd className="font-medium text-brand-700">{formatCurrency(slip.grossPay)}</dd>
          </div>
        </dl>
        {individualSlips.length > 1 && (
          <p className="mt-3 text-sm text-slate-600">
            Includes {individualSlips.length} finalized pay slips for this period (for example, regular and supplemental runs).
          </p>
        )}
      </div>

      <div className="space-y-2">
        <PaySlipDocument paySlip={slip} showActions={false} />
        {individualSlips.length === 1 ? (
          <Link
            to={`/employee/pay-slips/${slip.id}`}
            className="inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Open full pay slip
          </Link>
        ) : (
          <ul className="space-y-1 text-sm">
            {individualSlips.map((sourceSlip) => (
              <li key={sourceSlip.id}>
                <Link
                  to={`/employee/pay-slips/${sourceSlip.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Open pay slip {sourceSlip.paySlipNumber}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
