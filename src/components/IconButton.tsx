import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { classNames } from '../lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'default' | 'danger'
  children: ReactNode
}

export function iconLinkClassName(variant: 'default' | 'danger' = 'default'): string {
  return classNames(
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
    variant === 'danger'
      ? 'border-red-200 text-red-600 hover:bg-red-50'
      : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand-700',
  )
}

export function IconButton({
  label,
  variant = 'default',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={classNames(iconLinkClassName(variant), className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="m2.695 14.763-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
    </svg>
  )
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function RollbackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.793 2.232a.75.75 0 0 1-.128 1.05l-2.2 2.032h7.349a5.749 5.749 0 0 1 5.186 8.195 5.753 5.753 0 0 1-4.004 2.864.75.75 0 0 1-.312-1.47 4.253 4.253 0 0 0 2.963-2.12A4.25 4.25 0 0 0 5.75 6.532H3.543l2.2 2.032a.75.75 0 1 1-1.016 1.1l-3.5-3.25a.75.75 0 0 1 0-1.1l3.5-3.25a.75.75 0 0 1 1.05.17Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
