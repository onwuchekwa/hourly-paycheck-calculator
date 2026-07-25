import type { PaySlip } from '../lib/types'
import { formatCurrency, formatDecimalHours } from '../lib/utils'
import { ResponsiveTable, type ResponsiveTableColumn } from './ui/ResponsiveTable'

interface PaySlipSummaryTableProps {
  slips: PaySlip[]
  selectedId?: string
  onSelect?: (slip: PaySlip) => void
}

export function PaySlipSummaryTable({ slips, selectedId, onSelect }: PaySlipSummaryTableProps) {
  const totalHours = slips.reduce((sum, slip) => sum + slip.totalHours, 0)
  const totalGross = slips.reduce((sum, slip) => sum + slip.grossPay, 0)

  const columns: ResponsiveTableColumn<PaySlip>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (slip) => <span className="font-medium text-slate-900">{slip.employeeName}</span>,
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      render: (slip) => formatDecimalHours(slip.totalHours),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      className: 'font-semibold text-brand-700',
      render: (slip) => formatCurrency(slip.grossPay),
    },
  ]

  if (onSelect) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      mobileLabel: 'Details',
      render: (slip) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(slip)
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
        >
          {selectedId === slip.id ? 'Hide details' : 'View details'}
        </button>
      ),
    })
  }

  return (
    <ResponsiveTable
      columns={columns}
      rows={slips}
      keyField="id"
      selectedKey={selectedId}
      onRowClick={onSelect ? (slip) => onSelect(slip) : undefined}
      footer={
        <tr>
          <td className="pt-4 font-semibold text-slate-900">Total</td>
          <td className="pt-4 text-right font-semibold">{formatDecimalHours(totalHours)}</td>
          <td className="pt-4 text-right font-bold text-brand-700">{formatCurrency(totalGross)}</td>
          {onSelect && <td />}
        </tr>
      }
      mobileFooter={
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Total</p>
            <p className="text-sm text-slate-600">{formatDecimalHours(totalHours)} hours</p>
          </div>
          <span className="text-lg font-bold text-brand-700">{formatCurrency(totalGross)}</span>
        </div>
      }
    />
  )
}
