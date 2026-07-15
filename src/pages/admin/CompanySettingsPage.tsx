import { useEffect, useState, type FormEvent } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CompanySettings } from '../../lib/types'
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

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'settings', 'company'))
      if (snap.exists()) {
        setSettings(snap.data() as CompanySettings)
      }
      setLoading(false)
    }
    void load()
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    await setDoc(doc(db, 'settings', 'company'), settings, { merge: true })
    setMessage('Settings saved.')
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Company Settings</h1>
      <p className="page-subtitle">Configure company details for pay slips and reports.</p>

      <form onSubmit={handleSave} className="card mt-8 max-w-lg space-y-4">
        {message && (
          <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
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
          <label htmlFor="email" className="label-field">Email</label>
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
