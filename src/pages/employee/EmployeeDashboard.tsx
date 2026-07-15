import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { formatCurrency } from '../../lib/utils'
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
      const slipsSnap = await getDocs(slipsQ)
      const slips = slipsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
        .filter((s) => s.payPeriodStart.startsWith(year))
        .sort((a, b) => b.payPeriodEnd.localeCompare(a.payPeriodEnd))

      setYtdGross(slips.reduce((sum, s) => sum + s.grossPay, 0))
      setRecentSlips(slips.slice(0, 3))

      const entriesQ = query(
        collection(db, 'timeEntries'),
        where('employeeId', '==', profile.uid),
        where('status', 'in', ['draft', 'submitted', 'rejected']),
      )
      const entriesSnap = await getDocs(entriesQ)
      setPendingCount(entriesSnap.size)
      setLoading(false)
    }
    void load()
  }, [profile])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Welcome, {profile?.displayName}</h1>
      <p className="page-subtitle">Your payroll dashboard at a glance.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">YTD Gross Pay</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{formatCurrency(ytdGross)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Hourly Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(profile?.currentHourlyRate ?? 0)}/hr
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending Time Entries</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pendingCount}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/employee/timesheet" className="btn-primary">Go to Timesheet</Link>
        <Link to="/employee/pay-slips" className="btn-secondary">View Pay Slips</Link>
      </div>

      {recentSlips.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Recent Pay Slips</h2>
          <ul className="mt-4 space-y-2">
            {recentSlips.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/employee/pay-slips/${s.id}`}
                  className="card flex items-center justify-between py-3 hover:border-brand-300"
                >
                  <span className="font-medium">{s.paySlipNumber}</span>
                  <span className="text-sm text-slate-600">
                    {s.payPeriodStart} – {s.payPeriodEnd}
                  </span>
                  <span className="font-semibold text-brand-700">{formatCurrency(s.grossPay)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
