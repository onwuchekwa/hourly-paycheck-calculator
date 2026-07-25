import { useEffect, useState, type FormEvent } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CompanySettings } from '../../lib/types'
import { AlertBanner } from '../../components/AlertBanner'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    address: '',
    phone: '',
    email: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'success' | 'error'>('success')

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'company'))
        if (snap.exists()) {
          setSettings(snap.data() as CompanySettings)
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
      await setDoc(doc(db, 'settings', 'company'), settings, { merge: true })
      setMessageVariant('success')
      setMessage('Settings saved.')
    } catch {
      setMessageVariant('error')
      setMessage('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Company Settings</h1>
      <p className="page-subtitle">Configure company details for pay slips, reports, and outgoing email reply-to.</p>

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
