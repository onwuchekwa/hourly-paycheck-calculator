import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { adminHomePath } from '../lib/roles'

export function HomePage() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner fullPage />

  if (user && profile) {
    if (profile.mustChangePassword) return <Navigate to="/change-password" replace />
    return <Navigate to={adminHomePath(profile.role)} replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-xl font-bold text-brand-800">HourlyPay</span>
        <Link to="/login" className="btn-primary">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Hourly payroll, simplified.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Track time, review entries, and run payroll with clear pay slips for every employee.
            Sign in with the username and password provided by your employer.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/login" className="btn-primary px-6 py-3 text-base">
              Sign in to your account
            </Link>
          </div>
        </div>

        <section className="mt-12 rounded-xl border border-brand-100 bg-brand-50 p-6" aria-label="How it works">
          <h2 className="text-lg font-semibold text-slate-900">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Your employer creates your account and sends sign-in instructions by email.</li>
            <li>Clock in and out each workday, then submit your timesheet for approval.</li>
            <li>After payroll is finalized, view and download your pay slips.</li>
          </ol>
        </section>

        <section className="mt-12 grid gap-6 sm:grid-cols-3" aria-label="Features">
          {[
            {
              title: 'Clock in & out',
              desc: 'One-tap time tracking with calendar-based daily entries.',
            },
            {
              title: 'Employer review',
              desc: 'Approve, reject, or edit time with full audit history.',
            },
            {
              title: 'Pay slips & reports',
              desc: 'Finalize payroll runs and distribute printable pay slips.',
            },
          ].map((f) => (
            <article key={f.title} className="card">
              <h2 className="font-semibold text-slate-900">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        HourlyPay — Employer-managed payroll for hourly teams
      </footer>
    </div>
  )
}
