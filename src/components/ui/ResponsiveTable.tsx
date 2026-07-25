import type { ReactNode } from 'react'
import { classNames } from '../../lib/utils'

export interface ResponsiveTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  mobileLabel?: string
  hideOnMobile?: boolean
  render: (row: T) => ReactNode
  className?: string
}

interface ResponsiveTableProps<T extends object> {
  columns: ResponsiveTableColumn<T>[]
  rows: T[]
  keyField: keyof T & string
  emptyMessage?: string
  footer?: ReactNode
  /** Summary shown below the stacked cards on mobile, where <tfoot> is hidden. */
  mobileFooter?: ReactNode
  onRowClick?: (row: T) => void
  selectedKey?: string
}

export function ResponsiveTable<T extends object>({
  columns,
  rows,
  keyField,
  emptyMessage = 'No records found.',
  footer,
  mobileFooter,
  onRowClick,
  selectedKey,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">{emptyMessage}</p>
  }

  const mobileColumns = columns.filter((col) => !col.hideOnMobile)

  return (
    <>
      <div className="hidden md:block print:block table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={classNames(
                    'pb-3 font-medium',
                    col.align === 'right' && 'text-right',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowKey = String(row[keyField])
              const selected = selectedKey === rowKey
              return (
                <tr
                  key={rowKey}
                  className={classNames(
                    'border-b border-slate-100',
                    selected && 'bg-brand-50/60',
                    onRowClick && 'cursor-pointer hover:bg-slate-50',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={classNames(
                        'py-3',
                        col.align === 'right' && 'text-right',
                        col.className,
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      <div className="stack-cards md:hidden print:hidden">
        {rows.map((row) => {
          const rowKey = String(row[keyField])
          const selected = selectedKey === rowKey
          return (
            <div
              key={rowKey}
              className={classNames(
                'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
                selected && 'border-brand-300 bg-brand-50/40',
                onRowClick && 'cursor-pointer active:bg-slate-50',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              <dl className="space-y-2">
                {mobileColumns.map((col) => (
                  <div
                    key={col.key}
                    className={classNames(
                      'flex items-start justify-between gap-3 text-sm',
                      col.align === 'right' && 'flex-row-reverse text-right',
                    )}
                  >
                    <dt className="shrink-0 text-slate-500">{col.mobileLabel ?? col.header}</dt>
                    <dd className={classNames('font-medium text-slate-900', col.className)}>
                      {col.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
        {mobileFooter && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            {mobileFooter}
          </div>
        )}
      </div>
    </>
  )
}
