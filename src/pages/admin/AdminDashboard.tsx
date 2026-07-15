import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PayPeriod } from '../../lib/types'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function AdminDashboard() {
  const [employeeCount, setEmployeeCount] = useState(0)
  const [pendingReview, setPendingReview] = useState(0)
  const [openPeriod, setOpenPeriod] = useState<PayPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const empSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
      )
      setEmployeeCount(empSnap.size)

      const reviewSnap = await getDocs(
        query(collection(db, 'timeEntries'), where('status', '==', 'submitted')),
      )
      setPendingReview(reviewSnap.size)

      const periodSnap = await getDocs(
        query(collection(db, 'payPeriods'), where('status', '==', 'open')),
      )
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
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Overview of your payroll operations.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Active Employees</p>
          <p className="mt-1 text-2xl font-bold">{employeeCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending Time Review</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{pendingReview}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Open Pay Period</p>
          <p className="mt-1 text-lg font-bold">
            {openPeriod ? `${openPeriod.startDate} – ${openPeriod.endDate}` : 'None'}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/admin/employees" className="btn-primary">Manage Employees</Link>
        <Link to="/admin/time-review" className="btn-secondary">Review Time</Link>
        <Link to="/admin/payroll" className="btn-secondary">Run Payroll</Link>
      </div>
    </div>
  )
}
