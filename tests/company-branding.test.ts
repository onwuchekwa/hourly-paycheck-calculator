/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compressLogoFile,
  MAX_LOGO_BYTES,
  resolveLogoDataUrl,
  resolveShowLogo,
} from '../src/lib/companyBranding'
import {
  clearCachedCompanySettings,
  loadCachedCompanySettings,
  saveCachedCompanySettings,
} from '../src/lib/offline/companySettingsCache'
import type { CompanySettings } from '../src/lib/types'

const sampleSettings: CompanySettings = {
  companyName: 'Acme Corp',
  address: '123 Main St',
  phone: '555-0100',
  logoDataUrl: 'data:image/png;base64,abc',
  showLogo: true,
}

describe('companySettingsCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    clearCachedCompanySettings()
  })

  it('round-trips company settings through localStorage', () => {
    saveCachedCompanySettings(sampleSettings)
    expect(loadCachedCompanySettings()).toEqual(sampleSettings)
  })

  it('returns null for invalid cache payloads', () => {
    localStorage.setItem('payroll:companySettings', '{"bad":true}')
    expect(loadCachedCompanySettings()).toBeNull()
  })

  it('keeps cached company name when fetch would fail', () => {
    saveCachedCompanySettings(sampleSettings)
    const cached = loadCachedCompanySettings()
    expect(cached?.companyName).toBe('Acme Corp')
    expect(cached?.logoDataUrl).toBe('data:image/png;base64,abc')
  })
})

describe('resolveShowLogo', () => {
  it('prefers pay slip snapshot over live settings', () => {
    expect(resolveShowLogo(false, true, true)).toBe(false)
    expect(resolveShowLogo(true, false, true)).toBe(true)
  })

  it('falls back to settings then logo presence', () => {
    expect(resolveShowLogo(undefined, false, true)).toBe(false)
    expect(resolveShowLogo(undefined, undefined, true)).toBe(true)
    expect(resolveShowLogo(undefined, undefined, false)).toBe(false)
  })
})

describe('resolveLogoDataUrl', () => {
  it('returns snapshot logo when showLogo is true', () => {
    expect(
      resolveLogoDataUrl('data:image/png;base64,snap', 'data:image/png;base64,live', true),
    ).toBe('data:image/png;base64,snap')
  })

  it('falls back to settings logo when snapshot is empty', () => {
    expect(resolveLogoDataUrl('', 'data:image/png;base64,live', true)).toBe(
      'data:image/png;base64,live',
    )
  })

  it('returns undefined when showLogo is false', () => {
    expect(
      resolveLogoDataUrl('data:image/png;base64,snap', 'data:image/png;base64,live', false),
    ).toBeUndefined()
  })
})

describe('compressLogoFile', () => {
  it('rejects non-image files', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    await expect(compressLogoFile(file)).rejects.toThrow('Please choose an image file.')
  })

  it('rejects oversized SVG files', async () => {
    const oversizedBase64 = 'A'.repeat(Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 8)
    const file = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' })
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', {
        value: `data:image/svg+xml;base64,${oversizedBase64}`,
      })
      this.onload?.(new ProgressEvent('load'))
    })
    await expect(compressLogoFile(file)).rejects.toThrow('SVG logo must be under 150KB.')
    vi.restoreAllMocks()
  })
})
