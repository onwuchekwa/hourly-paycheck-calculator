import { useEffect, type ReactNode } from 'react'
import { classNames } from '../../lib/utils'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  id?: string
}

export function MobileDrawer({ open, onClose, title, children, footer, id }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Navigation menu'}
        className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl"
      >
        {title && (
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 px-4 py-4 pb-safe">{footer}</div>
        )}
      </aside>
    </div>
  )
}

interface RadioCardOption {
  value: string
  label: string
  description: string
}

interface RadioCardGroupProps {
  name: string
  legend: string
  value: string
  options: RadioCardOption[]
  onChange: (value: string) => void
}

export function RadioCardGroup({ name, legend, value, options, onChange }: RadioCardGroupProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="label-field">{legend}</legend>
      {options.map((option) => {
        const selected = value === option.value
        return (
          <label
            key={option.value}
            className={classNames(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
              selected
                ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/30'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <input
              type="radio"
              name={name}
              className="mt-1"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
              <span className="mt-0.5 block text-sm text-slate-600">{option.description}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

export function SegmentedControl({ options, value, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-auto"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={classNames(
              'min-h-10 flex-1 rounded-md px-4 text-sm font-medium transition sm:flex-none',
              selected
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
