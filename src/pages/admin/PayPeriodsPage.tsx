import { useEffect, useState, type FormEvent } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PayPeriod } from '../../lib/types'
import { DatePicker } from '../../components/DatePicker'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const q = query(collection(db, 'payPeriods'), orderBy('startDate', 'desc'))
    const snap = await getDocs(q)
    setPeriods(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const hasOpen = periods.some((p) => p.status === 'open')

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!startDate || !endDate || endDate < startDate) {
      setError('Valid start and end dates are required.')
      return
    }
    if (hasOpen) {
      setError('Close the current open pay period before creating a new one.')
      return
    }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'payPeriods'), {
        startDate,
        endDate,
        status: 'open',
        createdAt: serverTimestamp(),
      })
      setStartDate('')
      setEndDate('')
      await load()
    } catch {
      setError('Failed to create pay period.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async (id: string) => {
    await updateDoc(doc(db, 'payPeriods', id), {
      status: 'closed',
      closedAt: serverTimestamp(),
    })
    await load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Pay Periods</h1>
      <p className="page-subtitle">Manage pay periods — only one can be open at a time.</p>

      {!hasOpen && (
        <form onSubmit={handleCreate} className="card mt-6 max-w-lg space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <DatePicker label="Start date" value={startDate} onChange={setStartDate} required />
          <DatePicker label="End date" value={endDate} onChange={setEndDate} required />
          <button type="submit" disabled={submitting} className="btn-primary">
            Create Pay Period
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {periods.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{p.startDate} – {p.endDate}</p>
              <StatusBadge status={p.status} />
            </div>
            {p.status === 'open' && (
              <button type="button" onClick={() => handleClose(p.id)} className="btn-secondary text-xs">
                Close Period
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
