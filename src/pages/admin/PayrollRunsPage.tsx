import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useTaxSettings } from '../../contexts/TaxSettingsContext'
import { apiPost } from '../../lib/api'
import { db } from '../../lib/firebase'
import type {
  CompanySettings,
  PayPeriod,
  PayrollLineItem,
  PayrollRun,
  PayrollRunScope,
  PayrollRunType,
  TimeEntry,
  UserProfile,
} from '../../lib/types'
import { DEFAULT_COMPANY_NAME } from '../../lib/companyBranding'
import {
  buildPayrollSnapshot,
  collectPaidTimeEntryIdsForPeriod,
  excludePaidTimeEntries,
  formatPayrollRunLabel,
  getEmployeeIdsWithUnpaidApprovedHours,
  isLastFinalizedRunForPeriod,
  periodHasFinalizedRuns,
} from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { formatCurrency, formatDecimalHours } from '../../lib/utils'
import { formatTaxRateLabel } from '../../lib/tax'
import { getCallableErrorMessage } from '../../lib/errors'
import { AlertBanner } from '../../components/AlertBanner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { IconButton, RollbackIcon } from '../../components/IconButton'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { PageHeader, ResponsiveTable, type ResponsiveTableColumn } from '../../components/ui'

interface EmployeeOption {
  uid: string
  displayName: string
  currentHourlyRate?: number
}

export function PayrollRunsPage() {
  const { user } = useAuth()
  const { rates: taxRates, getRateForDate } = useTaxSettings()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [runType, setRunType] = useState<PayrollRunType>('regular')
  const [employeeScope, setEmployeeScope] = useState<PayrollRunScope>('all')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [preview, setPreview] = useState<PayrollRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [finalizeTarget, setFinalizeTarget] = useState<PayrollRun | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PayrollRun | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<PayrollRun | null>(null)
  const [emailOnFinalize, setEmailOnFinalize] = useState(true)
  const [supplementalEligibleIds, setSupplementalEligibleIds] = useState<Set<string>>(new Set())

  const load = async () => {
    const [periodSnap, runSnap, empSnap] = await Promise.all([
      getDocs(query(collection(db, 'payPeriods'), orderBy('startDate', 'desc'))),
      getDocs(query(collection(db, 'payrollRuns'), orderBy('createdAt', 'desc'))),
      getDocs(
        query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
      ),
    ])

    const periodList = periodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod)
    setPeriods(periodList)

    const openPeriods = periodList.filter((p) => p.status === 'open')
    setSelectedPeriodId((current) =>
      openPeriods.some((p) => p.id === current) ? current : openPeriods[0]?.id ?? '',
    )

    setRuns(runSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayrollRun))

    setEmployees(
      empSnap.docs
        .map((d) => {
          const data = d.data() as UserProfile
          return {
            uid: d.id,
            displayName: data.displayName,
            currentHourlyRate: data.currentHourlyRate,
          }
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    )
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (runType !== 'supplemental' || !selectedPeriodId) {
      setSupplementalEligibleIds(new Set())
      return
    }

    const period = periods.find((p) => p.id === selectedPeriodId)
    if (!period) return

    let cancelled = false
    void (async () => {
      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('workDate', '>=', period.startDate),
          where('workDate', '<=', period.endDate),
          where('status', '==', 'approved'),
        ),
      )
      if (cancelled) return
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)
      const paidEntryIds = collectPaidTimeEntryIdsForPeriod(runs, period.id)
      setSupplementalEligibleIds(getEmployeeIdsWithUnpaidApprovedHours(entries, paidEntryIds))
    })()

    return () => {
      cancelled = true
    }
  }, [runType, selectedPeriodId, periods, runs])

  const toggleEmployee = (uid: string) => {
    setSelectedEmployeeIds((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    )
  }

  const handlePreview = async () => {
    if (!selectedPeriodId) return
    if (employeeScope === 'selected' && selectedEmployeeIds.length === 0) {
      setError('Select at least one employee.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const period = periods.find((p) => p.id === selectedPeriodId)
      if (!period) return

      if (runType === 'regular' && periodHasFinalizedRuns(runs, period.id)) {
        setError(
          'This pay period already has finalized payroll. Use supplemental payroll for unpaid hours, or roll back the existing run first.',
        )
        return
      }

      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('workDate', '>=', period.startDate),
          where('workDate', '<=', period.endDate),
          where('status', '==', 'approved'),
        ),
      )
      let entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)

      let targetEmployees = employees
      if (employeeScope === 'selected') {
        targetEmployees = employees.filter((emp) => selectedEmployeeIds.includes(emp.uid))
      }

      if (runType === 'supplemental') {
        const paidEntryIds = collectPaidTimeEntryIdsForPeriod(runs, period.id)
        const eligibleEmployeeIds = getEmployeeIdsWithUnpaidApprovedHours(entries, paidEntryIds)

        if (
          employeeScope === 'selected' &&
          !selectedEmployeeIds.some((id) => eligibleEmployeeIds.has(id))
        ) {
          setError('Selected employee(s) have no unpaid approved hours for this period.')
          return
        }

        targetEmployees = targetEmployees.filter((emp) => eligibleEmployeeIds.has(emp.uid))
        entries = excludePaidTimeEntries(entries, paidEntryIds)
      }

      if (employeeScope === 'selected') {
        entries = entries.filter((entry) => selectedEmployeeIds.includes(entry.employeeId))
      }

      // Fetch every employee's rate history in parallel instead of one at a time.
      const rateLists = await Promise.all(targetEmployees.map((emp) => getEmployeeRates(emp.uid)))
      const ratesByEmployee = new Map<string, Awaited<ReturnType<typeof getEmployeeRates>>>()
      const fallbackRatesByEmployee = new Map<string, number>()
      targetEmployees.forEach((emp, i) => {
        ratesByEmployee.set(emp.uid, rateLists[i])
        fallbackRatesByEmployee.set(emp.uid, emp.currentHourlyRate ?? 0)
      })

      const lines = buildPayrollSnapshot(
        targetEmployees.map((e) => ({ uid: e.uid, displayName: e.displayName })),
        entries,
        ratesByEmployee,
        periods,
        fallbackRatesByEmployee,
        taxRates,
      )

      if (lines.length === 0) {
        setError(
          runType === 'supplemental'
            ? 'No unpaid approved hours found for the selected employees in this period.'
            : 'No approved hours found for the selected employees in this period.',
        )
        return
      }

      const totalGross = lines.reduce((s, l) => s + l.grossPay, 0)
      const totalHours = lines.reduce((s, l) => s + l.totalHours, 0)
      const totalTax = lines.reduce((s, l) => s + (l.tax ?? 0), 0)
      const totalNetPay = lines.reduce((s, l) => s + (l.netPay ?? l.grossPay), 0)
      const firstLine = lines[0]
      const runPayload = {
        payPeriodId: period.id,
        payPeriodStart: period.startDate,
        payPeriodEnd: period.endDate,
        status: 'preview' as const,
        runType,
        scope: employeeScope,
        ...(employeeScope === 'selected' ? { employeeIds: [...selectedEmployeeIds] } : {}),
        entries: lines,
        totalGross: Math.round(totalGross * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        taxYear: firstLine?.taxYear,
        taxRate: firstLine?.taxRate,
        taxRateId: firstLine?.taxRateId,
        totalTax: Math.round(totalTax * 100) / 100,
        totalNetPay: Math.round(totalNetPay * 100) / 100,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      }

      const runRef = await addDoc(collection(db, 'payrollRuns'), runPayload)

      const previewRun: PayrollRun = {
        id: runRef.id,
        ...runPayload,
        createdAt: undefined,
      }
      setPreview(previewRun)
      await load()
    } catch {
      setError('Failed to generate preview.')
    } finally {
      setBusy(false)
    }
  }

  const handleFinalize = async (run: PayrollRun) => {
    if (run.status !== 'preview') return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const settingsRef = doc(db, 'settings', 'company')
      const payrollSettingsRef = doc(db, 'settings', 'payroll')
      const [settingsSnap, payrollSnap] = await Promise.all([
        getDoc(settingsRef),
        getDoc(payrollSettingsRef),
      ])
      const settings = (settingsSnap.data() ?? {}) as CompanySettings
      const payrollSettings = payrollSnap.data() ?? {}
      const companyName = settings.companyName?.trim() || DEFAULT_COMPANY_NAME

      const year = new Date().getFullYear()
      let counter = (payrollSettings.lastPaySlipNumber as number) ?? 0
      let counterYear = (payrollSettings.paySlipCounterYear as number) ?? year
      if (counterYear !== year) {
        counterYear = year
        counter = 0
      }

      const batch = writeBatch(db)
      const empSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'employee')),
      )
      const emailMap = new Map(empSnap.docs.map((d) => [d.id, (d.data() as UserProfile).email]))

      for (const line of run.entries) {
        counter += 1
        const paySlipNumber = `PS-${year}-${String(counter).padStart(5, '0')}`
        const slipId = `${run.id}_${line.employeeId}`
        const slipRef = doc(db, 'paySlips', slipId)
        batch.set(slipRef, {
          paySlipNumber,
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeEmail: emailMap.get(line.employeeId) ?? '',
          payPeriodId: run.payPeriodId,
          payPeriodStart: run.payPeriodStart,
          payPeriodEnd: run.payPeriodEnd,
          payrollRunId: run.id,
          totalHours: line.totalHours,
          hourlyRate: line.hourlyRate,
          grossPay: line.grossPay,
          taxYear: line.taxYear,
          taxRate: line.taxRate,
          taxRateId: line.taxRateId,
          tax: line.tax,
          netPay: line.netPay,
          issueDate: run.payPeriodEnd,
          payDate: run.payPeriodEnd,
          companyName,
          companyAddress: settings.address ?? '',
          companyPhone: settings.phone ?? '',
          lineItems: line.dayBreakdown,
          generatedAt: serverTimestamp(),
          generatedBy: user?.uid,
        })
      }

      batch.update(doc(db, 'payrollRuns', run.id), {
        status: 'finalized',
        finalizedAt: serverTimestamp(),
        taxYear: run.taxYear,
        taxRate: run.taxRate,
        taxRateId: run.taxRateId,
        totalTax: run.totalTax,
        totalNetPay: run.totalNetPay,
      })

      batch.update(doc(db, 'payPeriods', run.payPeriodId), {
        status: 'closed',
        closedAt: serverTimestamp(),
      })

      batch.set(payrollSettingsRef, {
        lastPaySlipNumber: counter,
        paySlipCounterYear: counterYear,
      }, { merge: true })

      await batch.commit()

      if (emailOnFinalize) {
        const result = await apiPost<{ success: boolean; count: number }>('/api/email/payslip-batch', {
          payrollRunId: run.id,
        })
        setSuccess(`Payroll finalized. ${result.count} pay slip email(s) sent. Pay period closed.`)
      } else {
        setSuccess('Payroll finalized, pay slips generated, and pay period closed.')
      }

      setFinalizeTarget(null)
      setPreview(null)
      await load()
    } catch (err) {
      setError(getCallableErrorMessage(err, 'Failed to finalize payroll.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDeletePreview = async (run: PayrollRun) => {
    if (run.status !== 'preview') return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await deleteDoc(doc(db, 'payrollRuns', run.id))
      if (preview?.id === run.id) setPreview(null)
      setDeleteTarget(null)
      setSuccess('Preview payroll run deleted.')
      await load()
    } catch {
      setError('Failed to delete preview payroll run.')
    } finally {
      setBusy(false)
    }
  }

  const handleRollback = async (run: PayrollRun) => {
    if (run.status !== 'finalized') return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await apiPost<{
        success: boolean
        payPeriodReopened: boolean
        deletedSlipCount: number
      }>('/api/payroll/rollback', { payrollRunId: run.id })
      setRollbackTarget(null)
      setSuccess(
        result.payPeriodReopened
          ? `Payroll rolled back. ${result.deletedSlipCount} pay slip(s) deleted. Pay period reopened.`
          : `Payroll rolled back. ${result.deletedSlipCount} pay slip(s) deleted.`,
      )
      await load()
    } catch (err) {
      setError(getCallableErrorMessage(err, 'Failed to roll back payroll.'))
    } finally {
      setBusy(false)
    }
  }

  const finalizeDescription = () => {
    const count = finalizeTarget?.entries.length ?? 0
    const employeeLabel = count === 1 ? '1 employee' : `${count} employees`
    const runLabel = finalizeTarget?.runType === 'supplemental' ? 'supplemental payroll' : 'payroll run'
    if (emailOnFinalize) {
      return `This will generate pay slips for ${employeeLabel} in this ${runLabel} and email them. This action cannot be undone.`
    }
    return `This will generate pay slips for ${employeeLabel} in this ${runLabel}. This action cannot be undone.`
  }

  if (loading) return <LoadingSpinner />

  const openPeriods = periods.filter((p) => p.status === 'open')
  const displayRun = preview ?? runs.find((r) => r.status === 'preview') ?? null
  const selectedPeriodHasFinalizedRuns =
    selectedPeriodId !== '' && periodHasFinalizedRuns(runs, selectedPeriodId)
  const previewTaxRate = displayRun
    ? getRateForDate(displayRun.payPeriodEnd)
    : selectedPeriodId
      ? getRateForDate(periods.find((p) => p.id === selectedPeriodId)?.endDate ?? '')
      : null

  const previewColumns: ResponsiveTableColumn<PayrollLineItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (e) => e.employeeName,
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      render: (e) => formatDecimalHours(e.totalHours),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      render: (e) => `${formatCurrency(e.hourlyRate)}/hr`,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      className: 'font-medium',
      render: (e) => formatCurrency(e.grossPay),
    },
    {
      key: 'tax',
      header: 'Tax',
      align: 'right',
      render: (e) => (e.tax != null ? formatCurrency(e.tax) : '—'),
    },
    {
      key: 'net',
      header: 'Net Pay',
      align: 'right',
      className: 'font-medium text-brand-700',
      render: (e) => formatCurrency(e.netPay ?? e.grossPay),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payroll Runs"
        subtitle="Preview and finalize payroll for a pay period."
      />

      <div className="card mt-6 max-w-lg space-y-5">
        <div>
          <label htmlFor="period" className="label-field">Pay period</label>
          <select
            id="period"
            className="input-field"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
          >
            <option value="">
              {openPeriods.length === 0 ? 'No open pay periods' : 'Select a period'}
            </option>
            {openPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.startDate} – {p.endDate}
              </option>
            ))}
          </select>
          {openPeriods.length === 0 && (
            <p className="mt-2 text-sm text-slate-600">
              Reopen a closed pay period on the Pay Periods page to run supplemental payroll.
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="label-field">Run type</legend>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="runType"
              className="mt-1"
              checked={runType === 'regular'}
              disabled={selectedPeriodHasFinalizedRuns}
              onChange={() => setRunType('regular')}
            />
            <span>
              <span className="font-medium">Regular payroll</span>
              <span className="mt-0.5 block text-slate-500">
                Include all approved hours for the selected employees in this period.
              </span>
              {selectedPeriodHasFinalizedRuns && (
                <span className="mt-1 block text-amber-700">
                  Unavailable — this period already has finalized payroll. Use supplemental payroll or roll back an existing run.
                </span>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="runType"
              className="mt-1"
              checked={runType === 'supplemental'}
              onChange={() => setRunType('supplemental')}
            />
            <span>
              <span className="font-medium">Supplemental payroll</span>
              <span className="mt-0.5 block text-slate-500">
                Pay only unpaid approved hours — entries not yet included in a finalized payroll run for this period. Employees with no remaining unpaid hours are excluded.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label-field">Employees</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="employeeScope"
              checked={employeeScope === 'all'}
              onChange={() => setEmployeeScope('all')}
            />
            All active employees
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="employeeScope"
              checked={employeeScope === 'selected'}
              onChange={() => setEmployeeScope('selected')}
            />
            Selected employees
          </label>
        </fieldset>

        {employeeScope === 'selected' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Choose employees</p>
            <p className="mt-1 text-xs text-slate-500">
              Select one employee for a single-employee run, or multiple for a partial run.
            </p>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500">No active employees found.</p>
              ) : (
                employees.map((emp) => {
                  const ineligibleForSupplemental =
                    runType === 'supplemental' &&
                    Boolean(selectedPeriodId) &&
                    !supplementalEligibleIds.has(emp.uid)
                  return (
                    <label
                      key={emp.uid}
                      className={`flex items-center gap-2 text-sm ${
                        ineligibleForSupplemental ? 'text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.uid)}
                        disabled={ineligibleForSupplemental}
                        onChange={() => toggleEmployee(emp.uid)}
                      />
                      <span>
                        {emp.displayName}
                        {ineligibleForSupplemental && (
                          <span className="ml-1 text-xs">(No unpaid approved hours)</span>
                        )}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || !selectedPeriodId || (employeeScope === 'selected' && selectedEmployeeIds.length === 0)}
          className="btn-primary"
        >
          Generate Preview
        </button>
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {success && <AlertBanner variant="success">{success}</AlertBanner>}
      </div>

      {displayRun && (
        <div className="card mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="font-semibold">{formatPayrollRunLabel(displayRun)}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={displayRun.status} />
                {displayRun.runType === 'supplemental' && <StatusBadge status="supplemental" />}
                {displayRun.scope === 'selected' && displayRun.employeeIds?.length === 1 && (
                  <span className="text-xs text-slate-500">Single employee</span>
                )}
              </div>
              {displayRun.taxYear != null && displayRun.taxRate != null && (
                <p className="text-sm text-slate-600">
                  Tax Year {displayRun.taxYear} · Tax {formatTaxRateLabel(displayRun.taxRate)}
                </p>
              )}
              {!displayRun.taxRate && previewTaxRate && (
                <p className="text-sm text-slate-600">
                  Tax {formatTaxRateLabel(previewTaxRate.rate)} (effective {previewTaxRate.effectiveFrom})
                </p>
              )}
            </div>
            {displayRun.status === 'preview' && (
              <div className="flex flex-col items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={emailOnFinalize}
                    onChange={(e) => setEmailOnFinalize(e.target.checked)}
                  />
                  Email pay slips to employees after finalizing
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(displayRun)}
                    disabled={busy}
                    className="btn-danger"
                  >
                    Delete Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinalizeTarget(displayRun)}
                    disabled={busy}
                    className="btn-primary"
                  >
                    Finalize & Generate Pay Slips
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <ResponsiveTable
            columns={previewColumns}
            rows={displayRun.entries}
            keyField="employeeId"
            footer={
              <tr>
                <td className="pt-3 font-semibold">Total</td>
                <td className="pt-3 text-right font-semibold">
                  {formatDecimalHours(displayRun.totalHours)}
                </td>
                <td className="pt-3" />
                <td className="pt-3 text-right font-semibold">
                  {formatCurrency(displayRun.totalGross)}
                </td>
                <td className="pt-3 text-right font-semibold">
                  {displayRun.totalTax != null ? formatCurrency(displayRun.totalTax) : '—'}
                </td>
                <td className="pt-3 text-right font-bold text-brand-700">
                  {formatCurrency(displayRun.totalNetPay ?? displayRun.totalGross)}
                </td>
              </tr>
            }
            mobileFooter={
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Gross</p>
                    <p className="text-sm text-slate-600">
                      {formatDecimalHours(displayRun.totalHours)} hours
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(displayRun.totalGross)}
                  </span>
                </div>
                {displayRun.totalTax != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Tax</span>
                    <span className="font-medium">{formatCurrency(displayRun.totalTax)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Net Pay</span>
                  <span className="text-lg font-bold text-brand-700">
                    {formatCurrency(displayRun.totalNetPay ?? displayRun.totalGross)}
                  </span>
                </div>
              </div>
            }
          />
          </div>
          {displayRun.entries.some((e) => e.grossPay === 0 && e.totalHours > 0) && (
            <p className="mt-3 text-sm text-amber-800">
              Some employees show $0.00 gross because no hourly rate is on file. Set their rate on the Employees page.
            </p>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Preview Runs</h2>
        {runs.filter((r) => r.status === 'preview').length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No preview runs.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {runs.filter((r) => r.status === 'preview').map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p>{formatPayrollRunLabel(r)}</p>
                  <StatusBadge status={r.status} />
                </div>
                <span className="font-semibold">
                  {formatCurrency(r.totalNetPay ?? r.totalGross)}
                  {r.totalNetPay != null && (
                    <span className="ml-1 text-xs font-normal text-slate-500">net</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(r)}
                  disabled={busy}
                  className="btn-danger text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Past Runs</h2>
        <ul className="mt-4 space-y-2">
          {runs.filter((r) => r.status === 'finalized').map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p>{formatPayrollRunLabel(r)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {r.runType === 'supplemental' && <StatusBadge status="supplemental" />}
                  {r.scope === 'selected' && r.employeeIds?.length === 1 && (
                    <span className="text-xs text-slate-500">Single employee</span>
                  )}
                </div>
              </div>
              <span className="font-semibold">
                {formatCurrency(r.totalNetPay ?? r.totalGross)}
                {r.totalNetPay != null && (
                  <span className="ml-1 text-xs font-normal text-slate-500">net</span>
                )}
              </span>
              <Link to={`/admin/pay-slips?run=${r.id}`} className="text-brand-600 text-sm hover:underline">
                View slips
              </Link>
              <IconButton
                label="Rollback payroll run"
                variant="danger"
                disabled={busy}
                onClick={() => setRollbackTarget(r)}
              >
                <RollbackIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete preview payroll?"
        description={
          deleteTarget
            ? `This will permanently delete the preview for ${formatPayrollRunLabel(deleteTarget)}. No pay slips will be affected.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={() => deleteTarget && void handleDeletePreview(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={rollbackTarget !== null}
        title="Roll back payroll run?"
        description={
          rollbackTarget
            ? `This will permanently delete ${formatPayrollRunLabel(rollbackTarget)} and all pay slips from this run. Pay slip numbers already issued will not be reused.${
                isLastFinalizedRunForPeriod(runs, rollbackTarget.id, rollbackTarget.payPeriodId)
                  ? ' The pay period will be reopened.'
                  : ' Other finalized runs for this pay period will remain.'
              }`
            : ''
        }
        confirmLabel="Roll back"
        variant="danger"
        busy={busy}
        onConfirm={() => rollbackTarget && void handleRollback(rollbackTarget)}
        onCancel={() => setRollbackTarget(null)}
      />

      <ConfirmDialog
        open={finalizeTarget !== null}
        title="Finalize payroll?"
        description={finalizeDescription()}
        confirmLabel="Finalize"
        busy={busy}
        onConfirm={() => finalizeTarget && void handleFinalize(finalizeTarget)}
        onCancel={() => setFinalizeTarget(null)}
      />
    </div>
  )
}
