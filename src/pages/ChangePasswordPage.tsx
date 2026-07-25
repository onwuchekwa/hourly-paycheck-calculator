import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { adminHomePath } from '../lib/roles'
import { getPasswordChangeErrorMessage } from '../lib/errors'

export function ChangePasswordPage() {
  const { user, profile, loading, changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) return <LoadingSpinner fullPage />
  if (!user || !profile) return <Navigate to="/login" replace />
  if (!profile.mustChangePassword && !done) {
    return <Navigate to={adminHomePath(profile.role)} replace />
  }
  if (done) {
    return <Navigate to={adminHomePath(profile.role)} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!currentPassword) {
      setError('Enter your current (temporary) password.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, password)
      setDone(true)
    } catch (err) {
      setError(getPasswordChangeErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-600">
            For security, you must change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="current-password" className="label-field">Current (temporary) password</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              className="input-field"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label-field">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label-field">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              className="input-field"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
