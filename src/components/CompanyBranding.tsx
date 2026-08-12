import type { ReactNode } from 'react'
import { classNames } from '../lib/utils'

type CompanyBrandingSize = 'sm' | 'md' | 'lg'

interface CompanyBrandingProps {
  name: string
  logoDataUrl?: string
  showLogo?: boolean
  size?: CompanyBrandingSize
  subtitle?: ReactNode
  className?: string
  nameClassName?: string
}

const logoHeights: Record<CompanyBrandingSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
}

const nameSizes: Record<CompanyBrandingSize, string> = {
  sm: 'text-base font-bold',
  md: 'text-lg font-bold',
  lg: 'text-xl font-bold',
}

export function CompanyBranding({
  name,
  logoDataUrl,
  showLogo = false,
  size = 'md',
  subtitle,
  className,
  nameClassName,
}: CompanyBrandingProps) {
  const displayLogo = showLogo && Boolean(logoDataUrl)

  return (
    <div className={classNames('min-w-0', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {displayLogo && logoDataUrl && (
          <img
            src={logoDataUrl}
            alt=""
            className={classNames(logoHeights[size], 'w-auto shrink-0 object-contain')}
          />
        )}
        <div className="min-w-0">
          <div className={classNames(nameSizes[size], 'truncate text-slate-900', nameClassName)}>
            {name}
          </div>
          {subtitle}
        </div>
      </div>
    </div>
  )
}
