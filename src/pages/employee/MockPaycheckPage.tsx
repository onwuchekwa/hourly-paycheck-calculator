import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { MockPaycheckPreview, PayPeriod, PaySlip, TimeEntry, UserProfile } from '../../lib/types'
import { buildMockPaycheckForEmployee, mergeEmployeePaySlips, paySlipMatchesPeriod } from '../../lib/payroll'
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
  const { user, profile } = useAuth()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [periodPresetId, setPeriodPresetId] = useState('')
  const [viewMode, setViewMode] = useState<EarningsViewMode>('estimated')
  const [startDate, setStartDate] = useState(defaultStartDate())
  const [endDate, setEndDate] = useState(todayString())
  const [preview, setPreview] = useState<MockPaycheckPreview | null>(null)
  const [officialSlip, setOfficialSlip] = useState<PaySlip | null>(null)
  const [officialSourceSlips, setOfficialSourceSlips] = useState<PaySlip[]>([])
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
      if (openPeriod) {
        setPeriodPresetId(openPeriod.id)
        setStartDate(openPeriod.startDate)
        setEndDate(openPeriod.endDate)
      }

      setLoading(false)
    }
    void loadPeriods()
  }, [])

  const clearResults = () => {
    setPreview(null)
    setOfficialSlip(null)
    setOfficialSourceSlips([])
    setOfficialPeriod(null)
    setHasPreviewed(false)
    setError('')
  }

  const applyPeriodPreset = (periodId: string) => {
    setPeriodPresetId(periodId)
    if (!periodId) return
    const period = periods.find((p) => p.id === periodId)
    if (!period) return
    setStartDate(period.startDate)
    setEndDate(period.endDate)
    clearResults()
  }

  const resolveFallbackRate = async (uid: string): Promise<number> => {
    if (profile?.currentHourlyRate && profile.currentHourlyRate > 0) {
      return profile.currentHourlyRate
    }
    const userSnap = await getDoc(doc(db, 'users', uid))
    if (!userSnap.exists()) return 0
    return (userSnap.data() as UserProfile).currentHourlyRate ?? 0
  }

  const handlePreview = async () => {
    if (!profile || !user) return

    const employeeId = user.uid

    setBusy(true)
    setError('')
    setPreview(null)
    setOfficialSlip(null)
    setOfficialSourceSlips([])
    setOfficialPeriod(null)
    setHasPreviewed(true)

    try {
      if (viewMode === 'official') {
        const period = periods.find((p) => p.id === selectedPeriodId)
        if (!period) {
          setError('Select a pay period.')
          return
        }

        let slipsSnap = await getDocs(
          query(
            collection(db, 'paySlips'),
            where('employeeId', '==', employeeId),
            where('payPeriodId', '==', period.id),
          ),
        )

        let matchingSlips = slipsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
          .filter((slip) => slip.employeeId === employeeId && paySlipMatchesPeriod(slip, period))

        if (matchingSlips.length === 0) {
          slipsSnap = await getDocs(
            query(
              collection(db, 'paySlips'),
              where('employeeId', '==', employeeId),
              orderBy('payPeriodEnd', 'desc'),
            ),
          )
          matchingSlips = slipsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
            .filter((slip) => slip.employeeId === employeeId && paySlipMatchesPeriod(slip, period))
        }

        if (matchingSlips.length === 0) {
          setError('No official pay slip has been issued for this pay period yet.')
          return
        }

        const mergedSlip = mergeEmployeePaySlips(matchingSlips)
        if (!mergedSlip) {
          setError('No official pay slip has been issued for this pay period yet.')
          return
        }

        setOfficialPeriod(period)
        setOfficialSourceSlips(matchingSlips)
        setOfficialSlip(mergedSlip)
        return
      }

      if (!startDate || !endDate) {
        setError('Start and end dates are required.')
        return
      }
      if (startDate > endDate) {
        setError('Start date must be on or before end date.')
        return
      }

      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('employeeId', '==', employeeId),
          orderBy('workDate', 'desc'),
        ),
      )
      const entries = entriesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)
        .filter((e) => e.workDate >= startDate && e.workDate <= endDate)

      const [rates, fallbackRate] = await Promise.all([
        getEmployeeRates(profile.uid),
        resolveFallbackRate(profile.uid),
      ])

      const result = buildMockPaycheckForEmployee(
        profile.uid,
        profile.displayName,
        startDate,
        endDate,
        entries,
        rates,
        periods,
        fallbackRate,
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

  if (loading) return <LoadingSpinner />

  const hasResults = viewMode === 'official' ? officialSlip !== null : preview !== null

  return (
    <div>
      <h1 className="page-title">Earnings Preview</h1>
      <p className="page-subtitle">
        View official pay for a pay period or estimate earnings for a custom date range.
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
                View your finalized pay slip for an official pay period.
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
                Estimate earnings for a custom date range using your hourly rate(s).
              </span>
            </span>
          </label>
        </fieldset>

        {viewMode === 'official' ? (
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
        ) : (
          <>
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
          </>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={
            busy ||
            (viewMode === 'official' ? !selectedPeriodId : !startDate || !endDate)
          }
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

      {viewMode === 'official' && officialPeriod && officialSlip && (
        <div className="mt-8">
          <OfficialPayrollPreview
            period={officialPeriod}
            slip={officialSlip}
            sourceSlips={officialSourceSlips}
          />
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
            : 'No earnings to show for this date range.'}
        </p>
      )}
    </div>
  )
}
