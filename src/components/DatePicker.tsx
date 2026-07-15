import { useId } from 'react'
import { formatDate } from '../lib/utils'

interface DatePickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  id: externalId,
}: DatePickerProps) {
  const generatedId = useId()
  const id = externalId ?? generatedId

  return (
    <div>
      <label htmlFor={id} className="label-field">
        {label}
        {required && <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type="date"
        className="input-field"
        value={value}
        min={min}
        max={max ?? formatDate(new Date())}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-required={required}
      />
    </div>
  )
}
