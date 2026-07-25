import { useRef } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { PaySlip } from '../lib/types'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { resolveCompanyField, resolveCompanyName } from '../lib/companyBranding'
import { formatCurrency, formatDisplayDate, formatDecimalHours } from '../lib/utils'

interface PaySlipDocumentProps {
  paySlip: PaySlip
  showActions?: boolean
}

export function PaySlipDocument({ paySlip, showActions = true }: PaySlipDocumentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { settings, appTitle } = useCompanySettings()

  const companyName = resolveCompanyName(paySlip.companyName, settings.companyName || appTitle)
  const companyAddress = resolveCompanyField(paySlip.companyAddress, settings.address)
  const companyPhone = resolveCompanyField(paySlip.companyPhone, settings.phone)

  const handlePrint = () => window.print()

  const handlePdf = async () => {
    if (!ref.current) return
    const canvas = await html2canvas(ref.current, { scale: 2 })
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(img, 'PNG', 0, 0, w, h)
    pdf.save(`${paySlip.paySlipNumber}.pdf`)
  }

  return (
    <div>
      {showActions && (
        <div className="no-print mb-4 flex gap-2">
          <button type="button" onClick={handlePrint} className="btn-secondary">
            Print
          </button>
          <button type="button" onClick={handlePdf} className="btn-primary">
            Download PDF
          </button>
        </div>
      )}
      <div ref={ref} className="card max-w-2xl print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 pb-4 mb-4">
          <h2 className="text-xl font-bold text-slate-900">{companyName}</h2>
          {companyAddress && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{companyAddress}</p>
          )}
          {companyPhone && (
            <p className="mt-1 text-sm text-slate-600">{companyPhone}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-brand-700">
            Pay Slip {paySlip.paySlipNumber}
          </p>
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
        </dl>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium text-right">Hours</th>
              <th className="pb-2 font-medium text-right">Rate</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {paySlip.lineItems.map((line) => (
              <tr key={line.workDate} className="border-b border-slate-100">
                <td className="py-2">{formatDisplayDate(line.workDate)}</td>
                <td className="py-2 text-right">{formatDecimalHours(line.hours)}</td>
                <td className="py-2 text-right">{formatCurrency(line.rate)}</td>
                <td className="py-2 text-right">{formatCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-semibold">
                Gross Pay
              </td>
              <td className="pt-4 text-right font-bold text-brand-700">
                {formatCurrency(paySlip.grossPay)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
