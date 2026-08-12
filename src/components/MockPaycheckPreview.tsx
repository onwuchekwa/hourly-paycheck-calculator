import type { MockPaycheckPreview, MockPaycheckDayLine } from '../lib/types'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { isDateInPaidPeriod } from '../lib/payroll'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { AlertBanner } from './AlertBanner'
import { CompanyBranding } from './CompanyBranding'
import { StatusBadge } from './StatusBadge'
import { TaxBreakdownSummary } from './TaxBreakdownSummary'
import { ResponsiveTable, type ResponsiveTableColumn } from './ui/ResponsiveTable'

interface MockPaycheckPreviewProps {
  preview: MockPaycheckPreview
}

export function MockPaycheckPreviewCard({ preview }: MockPaycheckPreviewProps) {
  const { appTitle, logoDataUrl, showLogo } = useCompanySettings()
  const missingRate = preview.dayBreakdown.some((line) => line.rate <= 0)
  const paidPeriods = preview.includedPaidPeriods ?? []

  const columns: ResponsiveTableColumn<MockPaycheckDayLine>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (line) => {
        const inPaidPeriod =
          paidPeriods.length > 0 && isDateInPaidPeriod(line.workDate, paidPeriods)
        return (
          <span>
            {formatDisplayDate(line.workDate)}
            {inPaidPeriod && (
              <span className="ml-2 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                Paid period
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      render: (line) => formatDecimalHours(line.hours),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      render: (line) => formatCurrency(line.rate),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (line) => formatCurrency(line.amount),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (line) => <StatusBadge status={line.status} />,
    },
  ]

  return (
    <div className="card max-w-2xl">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <CompanyBranding
          name={appTitle}
          logoDataUrl={logoDataUrl}
          showLogo={showLogo}
          size="lg"
          subtitle={
            <p className="mt-1 text-sm text-slate-600">
              {formatDisplayDate(preview.payPeriodStart)} – {formatDisplayDate(preview.payPeriodEnd)}
            </p>
          }
        />
        <p className="mt-3 text-sm font-medium text-slate-700">Estimated Payroll</p>
      </div>

      <AlertBanner variant="warning" className="mb-4">
        Estimate only. Only approved time is included in actual payroll. Draft, submitted, or rejected
        hours may change or be excluded.
      </AlertBanner>

      {paidPeriods.length > 0 && (
        <AlertBanner variant="info" className="mb-4">
          <p className="font-medium">Includes already-paid pay period(s)</p>
          <p className="mt-1">
            Your date range overlaps official payroll for{' '}
            {paidPeriods
              .map(
                (period) =>
                  `${formatDisplayDate(period.startDate)} – ${formatDisplayDate(period.endDate)}`,
              )
              .join('; ')}
            . Days in those periods may already appear on a finalized pay slip.
          </p>
        </AlertBanner>
      )}

      {missingRate && (
        <AlertBanner variant="error" className="mb-4">
          Your hourly rate could not be determined for some dates. Contact your employer if amounts
          show $0.00.
        </AlertBanner>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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

      <TaxBreakdownSummary
        grossPay={preview.grossPay}
        tax={preview.tax}
        taxRate={preview.taxRate}
        netPay={preview.netPay}
        taxYear={preview.taxYear}
        estimated
        className="mb-6"
      />

      <ResponsiveTable
        columns={columns}
        rows={preview.dayBreakdown}
        keyField="workDate"
        footer={
          <tr>
            <td colSpan={3} className="pt-4 text-right font-semibold">
              Estimated Gross Pay
            </td>
            <td className="pt-4 text-right font-bold text-brand-700">
              {formatCurrency(preview.grossPay)}
            </td>
            <td />
          </tr>
        }
        mobileFooter={
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Estimated Gross Pay</span>
            <span className="text-lg font-bold text-brand-700">
              {formatCurrency(preview.grossPay)}
            </span>
          </div>
        }
      />
    </div>
  )
}
