import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPasswordChangeErrorMessage } from '../../lib/errors'

export function AccountSettingsPage() {
  const { profile, changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(getPasswordChangeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Account Settings</h1>
      <p className="page-subtitle">Manage your account information.</p>

      <div className="mt-8 max-w-lg space-y-8">
        <div className="card">
          <h2 className="font-semibold text-slate-900">Profile</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium">{profile?.displayName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium">{profile?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Hourly Rate</dt>
              <dd className="font-medium">${profile?.currentHourlyRate?.toFixed(2) ?? '0.00'}/hr</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            {error && (
              <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message}
              </div>
            )}
            <div>
              <label htmlFor="current-pw" className="label-field">Current password</label>
              <input
                id="current-pw"
                type="password"
                autoComplete="current-password"
                className="input-field"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="new-pw" className="label-field">New password</label>
              <input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="label-field">Confirm password</label>
              <input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                className="input-field"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              Update Password
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            Or use the dedicated{' '}
            <Link to="/change-password" className="text-brand-600 hover:underline">
              change password page
            </Link>{' '}
            if prompted on login.
          </p>
        </div>
      </div>
    </div>
  )
}
