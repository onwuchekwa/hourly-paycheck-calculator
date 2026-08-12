import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CompanySettings } from '../../lib/types'
import { useCompanySettings } from '../../contexts/CompanySettingsContext'
import { compressLogoFile } from '../../lib/companyBranding'
import { AlertBanner } from '../../components/AlertBanner'
import { LoadingSpinner } from '../../components/LoadingSpinner'

const EMPTY_SETTINGS: CompanySettings = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  showLogo: true,
}

export function CompanySettingsPage() {
  const { refreshSettings } = useCompanySettings()
  const [settings, setSettings] = useState<CompanySettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'success' | 'error'>('success')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'company'))
        if (snap.exists()) {
          const data = snap.data() as CompanySettings
          setSettings({
            ...EMPTY_SETTINGS,
            ...data,
            showLogo: data.showLogo ?? Boolean(data.logoDataUrl),
          })
        }
      } catch {
        setMessageVariant('error')
        setMessage('Failed to load company settings.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload: CompanySettings = {
        ...settings,
        showLogo: settings.logoDataUrl ? (settings.showLogo ?? true) : false,
      }
      await setDoc(doc(db, 'settings', 'company'), payload, { merge: true })
      await refreshSettings()
      setSettings(payload)
      setMessageVariant('success')
      setMessage('Settings saved.')
    } catch {
      setMessageVariant('error')
      setMessage('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage('')
    try {
      const logoDataUrl = await compressLogoFile(file)
      setSettings((prev) => ({
        ...prev,
        logoDataUrl,
        showLogo: prev.showLogo ?? true,
      }))
    } catch (err) {
      setMessageVariant('error')
      setMessage(err instanceof Error ? err.message : 'Failed to process logo.')
    }
  }

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logoDataUrl: undefined,
      showLogo: false,
    }))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Company Settings</h1>
      <p className="page-subtitle">Configure company details for pay slips, reports, and the site title.</p>

      <form onSubmit={handleSave} className="card mt-8 max-w-lg space-y-4">
        {message && <AlertBanner variant={messageVariant}>{message}</AlertBanner>}
        <div>
          <label htmlFor="companyName" className="label-field">Company name</label>
          <input
            id="companyName"
            className="input-field"
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            required
          />
        </div>

        <div>
          <span className="label-field">Company logo</span>
          <p className="mb-2 text-sm text-slate-600">
            Square logo recommended. Compressed to about 150KB for offline use.
          </p>
          {settings.logoDataUrl && (
            <div className="mb-3 flex items-center gap-3">
              <img
                src={settings.logoDataUrl}
                alt="Company logo preview"
                className="h-14 w-auto object-contain"
              />
              <button type="button" className="btn-secondary" onClick={handleRemoveLogo}>
                Remove logo
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {settings.logoDataUrl ? 'Replace logo' : 'Upload logo'}
          </button>
          {settings.logoDataUrl && (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.showLogo ?? true}
                onChange={(e) => setSettings({ ...settings, showLogo: e.target.checked })}
              />
              Show logo in app and documents
            </label>
          )}
        </div>

        <div>
          <label htmlFor="address" className="label-field">Address</label>
          <textarea
            id="address"
            className="input-field min-h-20"
            value={settings.address ?? ''}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="phone" className="label-field">Phone</label>
          <input
            id="phone"
            type="tel"
            className="input-field"
            value={settings.phone ?? ''}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="email" className="label-field">Company email (reply-to for employee emails)</label>
          <input
            id="email"
            type="email"
            className="input-field"
            value={settings.email ?? ''}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
