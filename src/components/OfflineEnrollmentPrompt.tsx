import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AlertBanner } from './AlertBanner'
import { getAuthErrorMessage } from '../lib/errors'
import { isUnlockLockedOut } from '../lib/offline/encryptedVault'

export function OfflineEnrollmentPrompt() {
  const { needsOfflineEnrollment, profile, enrollOfflineAccess } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!needsOfflineEnrollment || !profile || dismissed) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const lockout = await isUnlockLockedOut()
      if (lockout.locked) {
        setError(`Too many failed attempts. Try again after ${lockout.lockedUntil?.toLocaleTimeString()}.`)
        return
      }
      await enrollOfflineAccess(password)
      setPassword('')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-900">Enable offline access</h2>
      <p className="mt-1 text-sm text-brand-800">
        Enter your password once to save your profile on this device for offline timesheet use.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3" noValidate>
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        <div>
          <label htmlFor="offline-enroll-password" className="label-field">
            Password
          </label>
          <input
            id="offline-enroll-password"
            type="password"
            autoComplete="current-password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : 'Enable offline access'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>
            Not now
          </button>
        </div>
      </form>
    </div>
  )
}
