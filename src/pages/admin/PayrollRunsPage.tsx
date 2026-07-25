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
} from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { formatCurrency, formatDecimalHours } from '../../lib/utils'
import { getCallableErrorMessage } from '../../lib/errors'
import { AlertBanner } from '../../components/AlertBanner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
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
  const [emailOnFinalize, setEmailOnFinalize] = useState(true)

  const load = async () => {
    const periodSnap = await getDocs(
      query(collection(db, 'payPeriods'), orderBy('startDate', 'desc')),
    )
    const periodList = periodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod)
    setPeriods(periodList)

    const openPeriods = periodList.filter((p) => p.status === 'open')
    setSelectedPeriodId((current) =>
      openPeriods.some((p) => p.id === current) ? current : openPeriods[0]?.id ?? '',
    )

    const runSnap = await getDocs(
      query(collection(db, 'payrollRuns'), orderBy('createdAt', 'desc')),
    )
    setRuns(runSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayrollRun))

    const empSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
    )
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

      const entriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('workDate', '>=', period.startDate),
          where('workDate', '<=', period.endDate),
          where('status', '==', 'approved'),
        ),
      )
      let entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)

      if (runType === 'supplemental') {
        const paidEntryIds = collectPaidTimeEntryIdsForPeriod(runs, period.id)
        entries = excludePaidTimeEntries(entries, paidEntryIds)
      }

      let targetEmployees = employees
      if (employeeScope === 'selected') {
        targetEmployees = employees.filter((emp) => selectedEmployeeIds.includes(emp.uid))
        entries = entries.filter((entry) => selectedEmployeeIds.includes(entry.employeeId))
      }

      const ratesByEmployee = new Map<string, Awaited<ReturnType<typeof getEmployeeRates>>>()
      const fallbackRatesByEmployee = new Map<string, number>()
      for (const emp of targetEmployees) {
        ratesByEmployee.set(emp.uid, await getEmployeeRates(emp.uid))
        fallbackRatesByEmployee.set(emp.uid, emp.currentHourlyRate ?? 0)
      }

      const lines = buildPayrollSnapshot(
        targetEmployees.map((e) => ({ uid: e.uid, displayName: e.displayName })),
        entries,
        ratesByEmployee,
        periods,
        fallbackRatesByEmployee,
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
      const settingsSnap = await getDoc(settingsRef)
      const payrollSnap = await getDoc(payrollSettingsRef)
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
              onChange={() => setRunType('regular')}
            />
            <span>
              <span className="font-medium">Regular payroll</span>
              <span className="mt-0.5 block text-slate-500">
                Include all approved hours for the selected employees in this period.
              </span>
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
                Catch up employees missed in an earlier run by paying only hours not yet included in a finalized payroll for this period.
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
                employees.map((emp) => (
                  <label key={emp.uid} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(emp.uid)}
                      onChange={() => toggleEmployee(emp.uid)}
                    />
                    {emp.displayName}
                  </label>
                ))
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
                <td className="pt-3 text-right font-bold text-brand-700">
                  {formatCurrency(displayRun.totalGross)}
                </td>
              </tr>
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
                <span className="font-semibold">{formatCurrency(r.totalGross)}</span>
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
              <span className="font-semibold">{formatCurrency(r.totalGross)}</span>
              <Link to={`/admin/pay-slips?run=${r.id}`} className="text-brand-600 text-sm hover:underline">
                View slips
              </Link>
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
