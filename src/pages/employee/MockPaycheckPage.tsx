import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { MockPaycheckPreview, PayPeriod, PaySlip, TimeEntry } from '../../lib/types'
import { buildMockPaycheckForEmployee } from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { MockPaycheckPreviewCard } from '../../components/MockPaycheckPreview'
import { OfficialPayrollPreview } from '../../components/OfficialPayrollPreview'
import { LoadingSpinner } from '../../components/LoadingSpinner'

type EarningsViewMode = 'official' | 'estimated'

export function MockPaycheckPage() {
  const { profile } = useAuth()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [viewMode, setViewMode] = useState<EarningsViewMode>('estimated')
  const [preview, setPreview] = useState<MockPaycheckPreview | null>(null)
  const [officialSlips, setOfficialSlips] = useState<PaySlip[]>([])
  const [officialPeriod, setOfficialPeriod] = useState<PayPeriod | null>(null)
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

  const clearResults = () => {
    setPreview(null)
    setOfficialSlips([])
    setOfficialPeriod(null)
    setHasPreviewed(false)
    setError('')
  }

  const handlePreview = async () => {
    if (!profile) return

    const period = periods.find((p) => p.id === selectedPeriodId)
    if (!period) {
      setError('Select a pay period.')
      return
    }

    setBusy(true)
    setError('')
    setPreview(null)
    setOfficialSlips([])
    setOfficialPeriod(null)
    setHasPreviewed(true)

    try {
      if (viewMode === 'official') {
        const slipsSnap = await getDocs(
          query(
            collection(db, 'paySlips'),
            where('employeeId', '==', profile.uid),
            orderBy('payPeriodEnd', 'desc'),
          ),
        )
        const matchingSlips = slipsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
          .filter((slip) => slip.payPeriodId === period.id)

        if (matchingSlips.length === 0) {
          setError('No official pay slip has been issued for this pay period yet.')
          return
        }

        setOfficialPeriod(period)
        setOfficialSlips(matchingSlips)
        return
      }

      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('employeeId', '==', profile.uid),
          orderBy('workDate', 'desc'),
        ),
      )
      const entries = entriesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)
        .filter(
          (e) => e.workDate >= period.startDate && e.workDate <= period.endDate,
        )
      const rates = await getEmployeeRates(profile.uid)

      const result = buildMockPaycheckForEmployee(
        profile.uid,
        profile.displayName,
        period.id,
        period.startDate,
        period.endDate,
        entries,
        rates,
        profile.currentHourlyRate,
      )

      if (!result) {
        setError('No completed time entries found for this pay period.')
        return
      }

      setPreview(result)
    } catch {
      setError('Failed to load earnings preview.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const hasResults = viewMode === 'official' ? officialSlips.length > 0 : preview !== null

  return (
    <div>
      <h1 className="page-title">Earnings Preview</h1>
      <p className="page-subtitle">
        View official pay or estimate earnings for an official pay period.
      </p>

      <div className="card mt-8 max-w-lg space-y-5">
        <fieldset className="space-y-2">
          <legend className="label-field">View</legend>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="viewMode"
              className="mt-1"
              checked={viewMode === 'official'}
              onChange={() => {
                setViewMode('official')
                clearResults()
              }}
            />
            <span>
              <span className="font-medium">Official payroll</span>
              <span className="mt-0.5 block text-slate-500">
                View finalized pay slips for this pay period.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="viewMode"
              className="mt-1"
              checked={viewMode === 'estimated'}
              onChange={() => {
                setViewMode('estimated')
                clearResults()
              }}
            />
            <span>
              <span className="font-medium">Estimated payroll</span>
              <span className="mt-0.5 block text-slate-500">
                Estimate earnings using your hourly rate(s) for this pay period.
              </span>
            </span>
          </label>
        </fieldset>

        <div>
          <label htmlFor="pay-period" className="label-field">Pay period</label>
          <select
            id="pay-period"
            className="input-field"
            value={selectedPeriodId}
            onChange={(e) => {
              setSelectedPeriodId(e.target.value)
              clearResults()
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
          {busy ? 'Loading…' : viewMode === 'official' ? 'View official payroll' : 'Preview estimate'}
        </button>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {viewMode === 'official' && officialPeriod && officialSlips.length > 0 && (
        <div className="mt-8">
          <OfficialPayrollPreview period={officialPeriod} slips={officialSlips} />
        </div>
      )}

      {viewMode === 'estimated' && preview && (
        <div className="mt-8">
          <MockPaycheckPreviewCard preview={preview} />
        </div>
      )}

      {hasPreviewed && !hasResults && !error && !busy && (
        <p className="mt-8 text-sm text-slate-600">
          {viewMode === 'official'
            ? 'No official pay slip is available for this pay period.'
            : 'No earnings to estimate for this pay period.'}
        </p>
      )}
    </div>
  )
}
