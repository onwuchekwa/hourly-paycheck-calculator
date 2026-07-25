import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { MockPaycheckPreview, PayPeriod, PaySlip, TimeEntry } from '../../lib/types'
import { buildMockPaycheckForEmployee } from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { MockPaycheckPreviewCard } from '../../components/MockPaycheckPreview'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function MockPaycheckPage() {
  const { profile } = useAuth()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [preview, setPreview] = useState<MockPaycheckPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasPreviewed, setHasPreviewed] = useState(false)

  useEffect(() => {
    const loadPeriods = async () => {
      const snap = await getDocs(
        query(collection(db, 'payPeriods'), orderBy('startDate', 'desc')),
      )
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod)
      setPeriods(list)
      const openPeriod = list.find((p) => p.status === 'open')
      setSelectedPeriodId(openPeriod?.id ?? list[0]?.id ?? '')
      setLoading(false)
    }
    void loadPeriods()
  }, [])

  const handlePreview = async () => {
    if (!profile || !selectedPeriodId) return
    const period = periods.find((p) => p.id === selectedPeriodId)
    if (!period) return

    setBusy(true)
    setError('')
    setPreview(null)
    setHasPreviewed(true)

    try {
      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('employeeId', '==', profile.uid),
          orderBy('workDate', 'desc'),
        ),
      )
      const entries = entriesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)
        .filter((e) => e.workDate >= period.startDate && e.workDate <= period.endDate)
      const rates = await getEmployeeRates(profile.uid)

      const result = buildMockPaycheckForEmployee(
        profile.uid,
        profile.displayName,
        period.id,
        period.startDate,
        period.endDate,
        entries,
        rates,
      )

      if (!result) {
        setError('No completed time entries found for this period.')
        return
      }

      const slipsSnap = await getDocs(
        query(
          collection(db, 'paySlips'),
          where('employeeId', '==', profile.uid),
        ),
      )
      const existingSlip = slipsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
        .find((s) => s.payPeriodId === period.id)

      setPreview({
        ...result,
        existingPaySlipId: existingSlip?.id,
      })
    } catch {
      setError('Failed to load earnings preview.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Earnings Preview</h1>
      <p className="page-subtitle">
        Estimate your gross pay for a pay period based on recorded hours.
      </p>

      <div className="card mt-8 max-w-lg space-y-4">
        <div>
          <label htmlFor="pay-period" className="label-field">Pay period</label>
          <select
            id="pay-period"
            className="input-field"
            value={selectedPeriodId}
            onChange={(e) => {
              setSelectedPeriodId(e.target.value)
              setPreview(null)
              setHasPreviewed(false)
              setError('')
            }}
          >
            {periods.length === 0 ? (
              <option value="">No pay periods available</option>
            ) : (
              periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.startDate} – {p.endDate} ({p.status})
                </option>
              ))
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || !selectedPeriodId}
          className="btn-primary"
        >
          {busy ? 'Loading…' : 'Preview earnings'}
        </button>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {preview && (
        <div className="mt-8">
          <MockPaycheckPreviewCard preview={preview} />
        </div>
      )}

      {hasPreviewed && !preview && !error && !busy && (
        <p className="mt-8 text-sm text-slate-600">No earnings to preview for this period.</p>
      )}
    </div>
  )
}
