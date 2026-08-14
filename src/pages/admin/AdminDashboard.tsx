import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PayPeriod } from '../../lib/types'
import { AlertBanner } from '../../components/AlertBanner'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { PageHeader, StatCard } from '../../components/ui'

const DASHBOARD_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Dashboard request timeout')), DASHBOARD_TIMEOUT_MS),
    ),
  ])
}

export function AdminDashboard() {
  const [employeeCount, setEmployeeCount] = useState(0)
  const [pendingReview, setPendingReview] = useState(0)
  const [openPeriod, setOpenPeriod] = useState<PayPeriod | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Plain document reads instead of server-side aggregation: the
      // aggregation endpoint returned 429s under normal dashboard usage.
      const [employeesSnap, reviewSnap, periodSnap] = await Promise.all([
        withTimeout(
          getDocs(
            query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
          ),
        ),
        withTimeout(
          getDocs(query(collection(db, 'timeEntries'), where('status', '==', 'submitted'))),
        ),
        withTimeout(
          getDocs(query(collection(db, 'payPeriods'), where('status', '==', 'open'), limit(1))),
        ),
      ])

      setEmployeeCount(employeesSnap.size)
      setPendingReview(reviewSnap.size)
      setOpenPeriod(
        periodSnap.empty
          ? null
          : ({ id: periodSnap.docs[0].id, ...periodSnap.docs[0].data() } as PayPeriod),
      )
    } catch {
      setEmployeeCount(0)
      setPendingReview(0)
      setOpenPeriod(null)
      setError('Unable to load dashboard data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Overview of your payroll operations."
      />

      {error && (
        <AlertBanner variant="error" className="mt-6">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </AlertBanner>
      )}

      <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-3">
        <StatCard label="Active Employees" value={employeeCount} />
        <StatCard label="Pending Time Review" value={pendingReview} accent="warning" />
        <StatCard
          label="Open Pay Period"
          value={openPeriod ? `${openPeriod.startDate} – ${openPeriod.endDate}` : 'None'}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-wrap">
        <Link to="/admin/employees" className="btn-primary col-span-2 sm:col-span-1">
          Manage Employees
        </Link>
        <Link to="/admin/time-review" className="btn-secondary">
          Review Time
        </Link>
        <Link to="/admin/payroll" className="btn-secondary">
          Run Payroll
        </Link>
      </div>
    </div>
  )
}
