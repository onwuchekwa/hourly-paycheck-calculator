import { Link } from 'react-router-dom'
import type { MockPaycheckPreview } from '../lib/types'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { StatusBadge } from './StatusBadge'

interface MockPaycheckPreviewProps {
  preview: MockPaycheckPreview
}

export function MockPaycheckPreviewCard({ preview }: MockPaycheckPreviewProps) {
  return (
    <div className="card max-w-2xl">
      <div className="border-b border-slate-200 pb-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900">Mock Paycheck Estimate</h2>
        <p className="mt-1 text-sm text-slate-600">
          {formatDisplayDate(preview.payPeriodStart)} – {formatDisplayDate(preview.payPeriodEnd)}
        </p>
      </div>

      <div role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Estimate only. Only approved time is included in actual payroll. Draft, submitted, or rejected
        hours may change or be excluded.
      </div>

      {preview.existingPaySlipId && (
        <p className="mb-4 text-sm text-slate-600">
          A finalized pay slip exists for this period.{' '}
          <Link
            to={`/employee/pay-slips/${preview.existingPaySlipId}`}
            className="font-medium text-brand-600 hover:underline"
          >
            View official pay slip
          </Link>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
        <div>
          <dt className="text-slate-500">Employee</dt>
          <dd className="font-medium">{preview.employeeName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Avg. Rate</dt>
          <dd className="font-medium">{formatCurrency(preview.hourlyRate)}/hr</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total Hours</dt>
          <dd className="font-medium">{formatDecimalHours(preview.totalHours)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estimated Gross</dt>
          <dd className="font-medium text-brand-700">{formatCurrency(preview.grossPay)}</dd>
        </div>
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 font-medium">Date</th>
            <th className="pb-2 font-medium text-right">Hours</th>
            <th className="pb-2 font-medium text-right">Rate</th>
            <th className="pb-2 font-medium text-right">Amount</th>
            <th className="pb-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {preview.dayBreakdown.map((line) => (
            <tr key={line.workDate} className="border-b border-slate-100">
              <td className="py-2">{formatDisplayDate(line.workDate)}</td>
              <td className="py-2 text-right">{formatDecimalHours(line.hours)}</td>
              <td className="py-2 text-right">{formatCurrency(line.rate)}</td>
              <td className="py-2 text-right">{formatCurrency(line.amount)}</td>
              <td className="py-2 text-right">
                <StatusBadge status={line.status} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-4 text-right font-semibold">
              Estimated Gross Pay
            </td>
            <td className="pt-4 text-right font-bold text-brand-700">
              {formatCurrency(preview.grossPay)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
