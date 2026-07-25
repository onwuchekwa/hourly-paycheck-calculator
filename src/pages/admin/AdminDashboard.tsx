import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PayPeriod } from '../../lib/types'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { PageHeader, StatCard } from '../../components/ui'

export function AdminDashboard() {
  const [employeeCount, setEmployeeCount] = useState(0)
  const [pendingReview, setPendingReview] = useState(0)
  const [openPeriod, setOpenPeriod] = useState<PayPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Counts use server-side aggregation (no document downloads) and all
      // three requests run in parallel.
      const [empCount, reviewCount, periodSnap] = await Promise.all([
        getCountFromServer(
          query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
        ),
        getCountFromServer(
          query(collection(db, 'timeEntries'), where('status', '==', 'submitted')),
        ),
        getDocs(query(collection(db, 'payPeriods'), where('status', '==', 'open'), limit(1))),
      ])
      setEmployeeCount(empCount.data().count)
      setPendingReview(reviewCount.data().count)
      if (!periodSnap.empty) {
        const d = periodSnap.docs[0]
        setOpenPeriod({ id: d.id, ...d.data() } as PayPeriod)
      }
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Overview of your payroll operations."
      />

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
