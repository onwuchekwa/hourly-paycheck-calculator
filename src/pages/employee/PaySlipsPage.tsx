import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { formatCurrency, formatDisplayDate } from '../../lib/utils'
import { EmptyState, PageHeader } from '../../components/ui'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PaySlipsPage() {
  const { profile } = useAuth()
  const [slips, setSlips] = useState<PaySlip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const q = query(
        collection(db, 'paySlips'),
        where('employeeId', '==', profile.uid),
        orderBy('payPeriodEnd', 'desc'),
      )
      const snap = await getDocs(q)
      setSlips(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaySlip))
      setLoading(false)
    }
    void load()
  }, [profile])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="My Pay Slips" subtitle="View and download your pay slips." />

      {slips.length === 0 ? (
        <div className="mt-6 sm:mt-8">
          <EmptyState
            title="No pay slips yet"
            description="Pay slips will appear here after your employer finalizes payroll."
          />
        </div>
      ) : (
        <ul className="mt-6 stack-cards sm:mt-8">
          {slips.map((s) => (
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
                  <span className="text-lg font-bold text-brand-700">{formatCurrency(s.grossPay)}</span>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 text-slate-400" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.06-1.06l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
