import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { getCallableErrorMessage } from '../../lib/errors'
import { AlertBanner } from '../../components/AlertBanner'
import { PaySlipDocument } from '../../components/PaySlipDocument'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PaySlipViewPage() {
  const [searchParams] = useSearchParams()
  const runId = searchParams.get('run')
  const [slips, setSlips] = useState<PaySlip[]>([])
  const [selected, setSelected] = useState<PaySlip | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailing, setEmailing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'success' | 'error'>('success')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const constraints = runId ? [where('payrollRunId', '==', runId)] : []
        const q = query(collection(db, 'paySlips'), ...constraints, orderBy('paySlipNumber', 'desc'))
        const snap = await getDocs(q)
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
        setSlips(list)
        if (list.length > 0) setSelected(list[0])
      } catch {
        setLoadError('Failed to load pay slips.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [runId])

  const handleEmail = async () => {
    if (!selected) return
    setEmailing(true)
    setMessage('')
    try {
      const emailFn = httpsCallable<{ paySlipId: string }, { success: boolean }>(functions, 'emailPaySlip')
      await emailFn({ paySlipId: selected.id })
      setMessageVariant('success')
      setMessage(`Pay slip emailed to ${selected.employeeEmail}`)
    } catch (err) {
      setMessageVariant('error')
      setMessage(getCallableErrorMessage(err, 'Failed to send email.'))
    } finally {
      setEmailing(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Pay Slips</h1>
      <p className="page-subtitle">View and email employee pay slips.</p>

      {loadError && <AlertBanner variant="error" className="mt-4">{loadError}</AlertBanner>}

      {slips.length === 0 && !loadError ? (
        <p className="mt-8 text-slate-600">No pay slips found.</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ul className="space-y-2">
            {slips.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected?.id === s.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium">{s.paySlipNumber}</p>
                  <p className="text-slate-600">{s.employeeName}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="lg:col-span-2">
            {selected && (
              <>
                <div className="no-print mb-4 flex items-center gap-3">
                  <button type="button" onClick={handleEmail} disabled={emailing} className="btn-secondary">
                    {emailing ? 'Sending…' : 'Email Pay Slip'}
                  </button>
                  {message && (
                    <AlertBanner variant={messageVariant} className="flex-1">
                      {message}
                    </AlertBanner>
                  )}
                </div>
                <PaySlipDocument paySlip={selected} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
