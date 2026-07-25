import type { PaySlip } from '../lib/types'
import { formatCurrency, formatDecimalHours } from '../lib/utils'

interface PaySlipSummaryTableProps {
  slips: PaySlip[]
  selectedId?: string
  onSelect?: (slip: PaySlip) => void
}

export function PaySlipSummaryTable({ slips, selectedId, onSelect }: PaySlipSummaryTableProps) {
  const totalHours = slips.reduce((sum, slip) => sum + slip.totalHours, 0)
  const totalGross = slips.reduce((sum, slip) => sum + slip.grossPay, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-3 font-medium">Employee</th>
            <th className="pb-3 font-medium text-right">Hours</th>
            <th className="pb-3 font-medium text-right">Amount</th>
            {onSelect && <th className="pb-3 font-medium text-right"> </th>}
          </tr>
        </thead>
        <tbody>
          {slips.map((slip) => (
            <tr
              key={slip.id}
              className={`border-b border-slate-100 ${
                selectedId === slip.id ? 'bg-brand-50/60' : ''
              }`}
            >
              <td className="py-3 font-medium text-slate-900">{slip.employeeName}</td>
              <td className="py-3 text-right">{formatDecimalHours(slip.totalHours)}</td>
              <td className="py-3 text-right font-semibold text-brand-700">
                {formatCurrency(slip.grossPay)}
              </td>
              {onSelect && (
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(slip)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
                  >
                    {selectedId === slip.id ? 'Hide details' : 'View details'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-4 font-semibold text-slate-900">Total</td>
            <td className="pt-4 text-right font-semibold">{formatDecimalHours(totalHours)}</td>
            <td className="pt-4 text-right font-bold text-brand-700">{formatCurrency(totalGross)}</td>
            {onSelect && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
