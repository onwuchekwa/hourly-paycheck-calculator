import { useRef, useState } from 'react'
import type { PaySlip } from '../lib/types'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { resolveCompanyField, resolveCompanyName, resolveLogoDataUrl, resolveShowLogo } from '../lib/companyBranding'
import { captureElementToCanvas } from '../lib/payslipExport'
import { CompanyBranding } from './CompanyBranding'
import { formatTaxRateLabel } from '../lib/tax'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'
import { ResponsiveTable, type ResponsiveTableColumn } from './ui/ResponsiveTable'

interface PaySlipDocumentProps {
  paySlip: PaySlip
  showActions?: boolean
}

export function PaySlipDocument({ paySlip, showActions = true }: PaySlipDocumentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const { settings, appTitle } = useCompanySettings()

  const companyName = resolveCompanyName(paySlip.companyName, settings.companyName || appTitle)
  const companyAddress = resolveCompanyField(paySlip.companyAddress, settings.address)
  const companyPhone = resolveCompanyField(paySlip.companyPhone, settings.phone)
  const hasLogo = Boolean(paySlip.companyLogoDataUrl?.trim() || settings.logoDataUrl?.trim())
  const showCompanyLogo = resolveShowLogo(paySlip.showCompanyLogo, settings.showLogo, hasLogo)
  const logoDataUrl = resolveLogoDataUrl(
    paySlip.companyLogoDataUrl,
    settings.logoDataUrl,
    showCompanyLogo,
  )

  const handlePrint = () => window.print()

  const handlePdf = async () => {
    if (!ref.current || exporting) return
    setExporting(true)
    setExportError('')
    try {
      const canvas = await captureElementToCanvas(ref.current)
      const { jsPDF } = await import('jspdf')
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const w = pdf.internal.pageSize.getWidth()
      const h = (canvas.height * w) / canvas.width
      pdf.addImage(img, 'PNG', 0, 0, w, h)
      pdf.save(`${paySlip.paySlipNumber}.pdf`)
    } catch {
      setExportError('Could not generate PDF. Try Print and save as PDF instead.')
    } finally {
      setExporting(false)
    }
  }

  const lineColumns: ResponsiveTableColumn<(typeof paySlip.lineItems)[number]>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (line) => formatDisplayDate(line.workDate),
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
  ]

  return (
    <div>
      {showActions && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={handlePrint} className="btn-secondary">
            Print
          </button>
          <button type="button" onClick={handlePdf} disabled={exporting} className="btn-primary">
            {exporting ? 'Generating PDF…' : 'Download PDF'}
          </button>
          {exportError && <p className="text-sm text-red-600">{exportError}</p>}
        </div>
      )}
      <div
        ref={ref}
        data-payslip-export
        className="payslip-document card max-w-2xl print:border-0 print:shadow-none"
      >
        <div className="border-b border-slate-200 pb-4 mb-4">
          <CompanyBranding
            name={companyName}
            logoDataUrl={logoDataUrl}
            showLogo={showCompanyLogo}
            size="lg"
            subtitle={
              <>
                {companyAddress && (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{companyAddress}</p>
                )}
                {companyPhone && (
                  <p className="mt-1 text-sm text-slate-600">{companyPhone}</p>
                )}
                <p className="mt-2 text-sm font-semibold text-brand-700">
                  Pay Slip {paySlip.paySlipNumber}
                </p>
              </>
            }
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
          <div>
            <dt className="text-slate-500">Employee</dt>
            <dd className="font-medium">{paySlip.employeeName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Pay Date</dt>
            <dd className="font-medium">{formatDisplayDate(paySlip.payDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Period</dt>
            <dd className="font-medium">
              {formatDisplayDate(paySlip.payPeriodStart)} – {formatDisplayDate(paySlip.payPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Total Hours</dt>
            <dd className="font-medium">{formatDecimalHours(paySlip.totalHours)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Hourly Rate</dt>
            <dd className="font-medium">{formatCurrency(paySlip.hourlyRate)}/hr</dd>
          </div>
          <div>
            <dt className="text-slate-500">Gross Pay</dt>
            <dd className="text-lg font-bold text-brand-700">{formatCurrency(paySlip.grossPay)}</dd>
          </div>
          {paySlip.taxYear != null && (
            <div>
              <dt className="text-slate-500">Tax Year</dt>
              <dd className="font-medium">{paySlip.taxYear}</dd>
            </div>
          )}
        </dl>
        {paySlip.tax != null && paySlip.netPay != null && paySlip.taxRate != null && (
          <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="col-span-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Deductions
            </div>
            <div>
              <dt className="text-slate-600">Tax ({formatTaxRateLabel(paySlip.taxRate)})</dt>
              <dd className="font-medium text-red-700">−{formatCurrency(paySlip.tax)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Net Pay</dt>
              <dd className="text-lg font-bold text-brand-700">{formatCurrency(paySlip.netPay)}</dd>
            </div>
          </dl>
        )}
        <ResponsiveTable
          columns={lineColumns}
          rows={paySlip.lineItems}
          keyField="workDate"
          footer={
            <tr>
              <td colSpan={3} className="pt-4 text-right font-semibold">
                Gross Pay
              </td>
              <td className="pt-4 text-right font-bold text-brand-700">
                {formatCurrency(paySlip.grossPay)}
              </td>
            </tr>
          }
          mobileFooter={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Gross Pay</span>
              <span className="text-lg font-bold text-brand-700">
                {formatCurrency(paySlip.grossPay)}
              </span>
            </div>
          }
        />
      </div>
    </div>
  )
}
