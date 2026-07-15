import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { formatCurrency, formatDisplayDate } from '../../lib/utils'
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
      <h1 className="page-title">My Pay Slips</h1>
      <p className="page-subtitle">View and download your pay slips.</p>

      {slips.length === 0 ? (
        <p className="mt-8 text-slate-600">No pay slips available yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {slips.map((s) => (
            <li key={s.id}>
              <Link
                to={`/employee/pay-slips/${s.id}`}
                className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand-300"
              >
                <div>
                  <p className="font-semibold text-slate-900">{s.paySlipNumber}</p>
                  <p className="text-sm text-slate-600">
                    {formatDisplayDate(s.payPeriodStart)} – {formatDisplayDate(s.payPeriodEnd)}
                  </p>
                </div>
                <p className="text-lg font-bold text-brand-700">{formatCurrency(s.grossPay)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
