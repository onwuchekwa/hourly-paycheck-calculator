import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { AlertBanner } from '../components/AlertBanner'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useFirebaseEmulators } from '../lib/firebase-config'
import { getAuthErrorMessage } from '../lib/errors'
import { adminHomePath } from '../lib/roles'

export function LoginPage() {
  const { login, user, profile, loading } = useAuth()
  const { appTitle } = useCompanySettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const usingEmulators = useFirebaseEmulators()

  if (loading) return <LoadingSpinner fullPage />

  if (user && profile) {
    if (profile.mustChangePassword) return <Navigate to="/change-password" replace />
    return <Navigate to={adminHomePath(profile.role)} replace />
  }

  if (user && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="card w-full max-w-md space-y-4 border border-slate-200 shadow-md">
          <h1 className="text-xl font-bold text-slate-900">Account setup incomplete</h1>
          <AlertBanner variant="error">
            You signed in successfully, but your Firestore user profile is missing. An admin must
            create a document at{' '}
            <code className="rounded bg-white px-1">users/{user.uid}</code> with{' '}
            <code className="rounded bg-white px-1">role: &quot;admin&quot;</code> (or{' '}
            <code className="rounded bg-white px-1">&quot;employer&quot;</code>), your display name,
            and <code className="rounded bg-white px-1">active: true</code>.
          </AlertBanner>
          <p className="text-sm text-slate-600">
            Signed in as <strong>{user.email}</strong>
          </p>
          <Link to="/" className="btn-secondary inline-block text-center">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card mb-6 border border-slate-200 bg-white px-6 py-8 text-center shadow-md">
          <Link to="/" className="text-xl font-bold text-brand-800">
            {appTitle}
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Use the credentials provided by your employer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 border border-slate-200 shadow-md" noValidate>
          {error && <AlertBanner variant="error">{error}</AlertBanner>}
          <div>
            <label htmlFor="email" className="label-field">
              Username (email)
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label-field">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {usingEmulators && (
          <AlertBanner variant="warning" className="mt-4">
            Local emulator mode — run <code className="rounded bg-white px-1">npm run seed:emulator</code>{' '}
            then sign in with <strong>admin@local.test</strong> / <strong>password123</strong>
          </AlertBanner>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="text-brand-600 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
