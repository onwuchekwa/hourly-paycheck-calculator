import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { autoCloseStalePunches } from '../../lib/timeEntries'
import { formatCurrency, formatDisplayDate } from '../../lib/utils'
import { PageHeader, StatCard } from '../../components/ui'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function EmployeeDashboard() {
  const { profile } = useAuth()
  const [ytdGross, setYtdGross] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [recentSlips, setRecentSlips] = useState<PaySlip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const year = new Date().getFullYear().toString()
      const slipsQ = query(
        collection(db, 'paySlips'),
        where('employeeId', '==', profile.uid),
      )
      const entriesQ = query(
        collection(db, 'timeEntries'),
        where('employeeId', '==', profile.uid),
        where('status', 'in', ['draft', 'submitted', 'rejected']),
      )

      // Stale-punch cleanup only touches punch times (not entry statuses), so
      // it can safely run alongside the dashboard reads.
      const [slipsSnap, entriesCount] = await Promise.all([
        getDocs(slipsQ),
        getCountFromServer(entriesQ),
        autoCloseStalePunches(profile.uid),
      ])

      const slips = slipsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
        .filter((s) => s.payPeriodStart.startsWith(year))
        .sort((a, b) => b.payPeriodEnd.localeCompare(a.payPeriodEnd))

      setYtdGross(slips.reduce((sum, s) => sum + s.grossPay, 0))
      setRecentSlips(slips.slice(0, 3))
      setPendingCount(entriesCount.data().count)
      setLoading(false)
    }
    void load()
  }, [profile])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.displayName}`}
        subtitle="Your payroll dashboard at a glance."
      />

      <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-3">
        <StatCard label="YTD Gross Pay" value={formatCurrency(ytdGross)} accent="brand" />
        <StatCard
          label="Hourly Rate"
          value={`${formatCurrency(profile?.currentHourlyRate ?? 0)}/hr`}
        />
        <StatCard
          label="Pending Time Entries"
          value={pendingCount}
          accent={pendingCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-wrap">
        <Link to="/employee/timesheet" className="btn-primary col-span-2 sm:col-span-1">
          Go to Timesheet
        </Link>
        <Link to="/employee/mock-paycheck" className="btn-secondary">
          Preview Earnings
        </Link>
        <Link to="/employee/pay-slips" className="btn-secondary">
          View Pay Slips
        </Link>
      </div>

      {recentSlips.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <h2 className="section-title">Recent Pay Slips</h2>
          <ul className="mt-4 stack-cards">
            {recentSlips.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/employee/pay-slips/${s.id}`}
                  className="card-interactive flex items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{s.paySlipNumber}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {formatDisplayDate(s.payPeriodStart)} – {formatDisplayDate(s.payPeriodEnd)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-brand-700">{formatCurrency(s.grossPay)}</span>
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 text-slate-400" fill="currentColor">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
