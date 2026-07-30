import { formatCurrency } from '../lib/utils'
import { formatTaxRateLabel } from '../lib/tax'

interface TaxBreakdownSummaryProps {
  grossPay: number
  tax?: number
  taxRate?: number
  netPay?: number
  taxYear?: number
  estimated?: boolean
  className?: string
}

export function TaxBreakdownSummary({
  grossPay,
  tax,
  taxRate,
  netPay,
  taxYear,
  estimated = false,
  className = '',
}: TaxBreakdownSummaryProps) {
  if (tax == null || netPay == null || taxRate == null) return null

  const prefix = estimated ? 'Estimated ' : ''
  const rateLabel = formatTaxRateLabel(taxRate)

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm ${className}`}>
      {taxYear != null && (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Tax Year {taxYear}
        </p>
      )}
      <dl className="space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">{prefix}Gross Pay</dt>
          <dd className="font-medium text-slate-900">{formatCurrency(grossPay)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">
            {prefix}Tax ({rateLabel})
          </dt>
          <dd className="font-medium text-red-700">−{formatCurrency(tax)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <dt className="font-semibold text-slate-900">{prefix}Net Pay</dt>
          <dd className="text-lg font-bold text-brand-700">{formatCurrency(netPay)}</dd>
        </div>
      </dl>
    </div>
  )
}
