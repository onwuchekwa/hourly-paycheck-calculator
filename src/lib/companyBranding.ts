export const DEFAULT_COMPANY_NAME = 'Company'

export function resolveCompanyName(
  stored: string | undefined,
  settings: string | undefined,
): string {
  const fromSettings = settings?.trim()
  const fromStored = stored?.trim()
  if (fromStored && fromStored !== DEFAULT_COMPANY_NAME) return fromStored
  if (fromSettings) return fromSettings
  return DEFAULT_COMPANY_NAME
}

export function resolveCompanyField(
  stored: string | undefined,
  settings: string | undefined,
): string {
  const fromStored = stored?.trim()
  if (fromStored) return fromStored
  return settings?.trim() ?? ''
}
