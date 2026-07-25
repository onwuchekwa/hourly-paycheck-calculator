import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { MockPaycheckPreview, PayPeriod, PaySlip, TimeEntry } from '../../lib/types'
import {
  buildMockPaycheckForEmployee,
  filterPaySlipToDateRange,
  paySlipOverlapsRange,
} from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { formatDate, todayString } from '../../lib/utils'
import { DatePicker } from '../../components/DatePicker'
import { MockPaycheckPreviewCard } from '../../components/MockPaycheckPreview'
import { OfficialPayrollPreview } from '../../components/OfficialPayrollPreview'
import { LoadingSpinner } from '../../components/LoadingSpinner'

type EarningsViewMode = 'official' | 'estimated'

function defaultStartDate(): string {
  const now = new Date()
  return formatDate(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function MockPaycheckPage() {
  const { profile } = useAuth()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [periodPresetId, setPeriodPresetId] = useState('')
  const [viewMode, setViewMode] = useState<EarningsViewMode>('estimated')
  const [startDate, setStartDate] = useState(defaultStartDate())
  const [endDate, setEndDate] = useState(todayString())
  const [preview, setPreview] = useState<MockPaycheckPreview | null>(null)
  const [officialSlips, setOfficialSlips] = useState<PaySlip[]>([])
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
      if (openPeriod) {
        setPeriodPresetId(openPeriod.id)
        setStartDate(openPeriod.startDate)
        setEndDate(openPeriod.endDate)
      }

      setLoading(false)
    }
    void loadPeriods()
  }, [])

  const applyPeriodPreset = (periodId: string) => {
    setPeriodPresetId(periodId)
    const period = periods.find((p) => p.id === periodId)
    if (!period) return
    setStartDate(period.startDate)
    setEndDate(period.endDate)
    setPreview(null)
    setOfficialSlips([])
    setHasPreviewed(false)
    setError('')
  }

  const validateRange = (): string | null => {
    if (!startDate || !endDate) return 'Start and end dates are required.'
    if (startDate > endDate) return 'Start date must be on or before end date.'
    return null
  }

  const handlePreview = async () => {
    if (!profile) return
    const rangeError = validateRange()
    if (rangeError) {
      setError(rangeError)
      return
    }

    setBusy(true)
    setError('')
    setPreview(null)
    setOfficialSlips([])
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
          .filter((slip) => paySlipOverlapsRange(slip, startDate, endDate))
          .map((slip) => filterPaySlipToDateRange(slip, startDate, endDate))
          .filter((slip): slip is PaySlip => slip !== null)

        if (matchingSlips.length === 0) {
          setError('No official pay slips found for this date range. Try estimated payroll instead.')
          return
        }

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
        .filter((e) => e.workDate >= startDate && e.workDate <= endDate)
      const rates = await getEmployeeRates(profile.uid)

      const result = buildMockPaycheckForEmployee(
        profile.uid,
        profile.displayName,
        '',
        startDate,
        endDate,
        entries,
        rates,
      )

      if (!result) {
        setError('No completed time entries found for this date range.')
        return
      }

      setPreview(result)
    } catch {
      setError('Failed to load earnings preview.')
    } finally {
      setBusy(false)
    }
  }

  const clearResults = () => {
    setPreview(null)
    setOfficialSlips([])
    setHasPreviewed(false)
    setError('')
  }

  if (loading) return <LoadingSpinner />

  const hasResults = viewMode === 'official' ? officialSlips.length > 0 : preview !== null

  return (
    <div>
      <h1 className="page-title">Earnings Preview</h1>
      <p className="page-subtitle">
        View official pay slips or estimate gross pay for any date range.
      </p>

      <div className="card mt-8 max-w-lg space-y-5">
        <fieldset className="space-y-2">
          <legend className="label-field">View</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="viewMode"
              checked={viewMode === 'official'}
              onChange={() => {
                setViewMode('official')
                clearResults()
              }}
            />
            Official payroll
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="viewMode"
              checked={viewMode === 'estimated'}
              onChange={() => {
                setViewMode('estimated')
                clearResults()
              }}
            />
            Estimated payroll
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Start date"
            value={startDate}
            max={endDate || todayString()}
            onChange={(value) => {
              setStartDate(value)
              setPeriodPresetId('')
              clearResults()
            }}
            required
          />
          <DatePicker
            label="End date"
            value={endDate}
            min={startDate}
            onChange={(value) => {
              setEndDate(value)
              setPeriodPresetId('')
              clearResults()
            }}
            required
          />
        </div>

        {periods.length > 0 && (
          <div>
            <label htmlFor="period-preset" className="label-field">
              Fill dates from pay period (optional)
            </label>
            <select
              id="period-preset"
              className="input-field"
              value={periodPresetId}
              onChange={(e) => applyPeriodPreset(e.target.value)}
            >
              <option value="">Custom date range</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.startDate} – {p.endDate} ({p.status})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || !startDate || !endDate}
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

      {viewMode === 'official' && officialSlips.length > 0 && (
        <div className="mt-8">
          <OfficialPayrollPreview slips={officialSlips} startDate={startDate} endDate={endDate} />
        </div>
      )}

      {viewMode === 'estimated' && preview && (
        <div className="mt-8">
          <MockPaycheckPreviewCard preview={preview} />
        </div>
      )}

      {hasPreviewed && !hasResults && !error && !busy && (
        <p className="mt-8 text-sm text-slate-600">No earnings to show for this date range.</p>
      )}
    </div>
  )
}
