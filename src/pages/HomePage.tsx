import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { CompanyBranding } from '../components/CompanyBranding'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { adminHomePath } from '../lib/roles'

export function HomePage() {
  const { user, profile, loading } = useAuth()
  const { appTitle, logoDataUrl, showLogo } = useCompanySettings()

  if (loading) return <LoadingSpinner fullPage />

  if (user && profile) {
    if (profile.mustChangePassword) return <Navigate to="/change-password" replace />
    return <Navigate to={adminHomePath(profile.role)} replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <CompanyBranding
          name={appTitle}
          logoDataUrl={logoDataUrl}
          showLogo={showLogo}
          size="md"
          nameClassName="text-brand-800"
        />
        <Link to="/login" className="btn-primary shrink-0">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Hourly payroll, simplified.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:mt-6 sm:text-lg">
            Track time, review entries, and run payroll with clear pay slips for every employee.
            Sign in with the username and password provided by your employer.
          </p>
          <div className="mt-8 sm:mt-10">
            <Link to="/login" className="btn-primary w-full sm:w-auto">
              Sign in to your account
            </Link>
          </div>
        </div>

        <section
          className="mt-10 rounded-xl border border-brand-100 bg-brand-50 p-4 sm:mt-12 sm:p-6"
          aria-label="How it works"
        >
          <h2 className="section-title">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Your employer creates your account and sends sign-in instructions by email.</li>
            <li>Clock in and out each workday, then submit your timesheet for approval.</li>
            <li>After payroll is finalized, view and download your pay slips.</li>
          </ol>
        </section>

        <section className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6" aria-label="Features">
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

      <footer className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-500 sm:py-8">
        {appTitle} — Employer-managed payroll for hourly teams
      </footer>
    </div>
  )
}
