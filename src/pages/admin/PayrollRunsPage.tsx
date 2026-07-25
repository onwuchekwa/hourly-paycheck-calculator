import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  getDocs,
  addDoc,
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
import type { PayPeriod, PayrollRun, TimeEntry, UserProfile, CompanySettings } from '../../lib/types'
import { buildPayrollSnapshot } from '../../lib/payroll'
import { getEmployeeRates } from '../../lib/rates'
import { formatCurrency } from '../../lib/utils'
import { getCallableErrorMessage } from '../../lib/errors'
import { AlertBanner } from '../../components/AlertBanner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PayrollRunsPage() {
  const { user } = useAuth()
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [preview, setPreview] = useState<PayrollRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [finalizeTarget, setFinalizeTarget] = useState<PayrollRun | null>(null)
  const [emailOnFinalize, setEmailOnFinalize] = useState(true)

  const load = async () => {
    const periodSnap = await getDocs(
      query(collection(db, 'payPeriods'), orderBy('startDate', 'desc')),
    )
    const periodList = periodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod)
    setPeriods(periodList)

    const runSnap = await getDocs(
      query(collection(db, 'payrollRuns'), orderBy('createdAt', 'desc')),
    )
    setRuns(runSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayrollRun))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const handlePreview = async () => {
    if (!selectedPeriodId) return
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
      const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry)

      const empSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'employee'), where('active', '==', true)),
      )
      const employees = empSnap.docs.map((d) => ({
        uid: d.id,
        displayName: (d.data() as UserProfile).displayName,
        email: (d.data() as UserProfile).email,
      }))

      const ratesByEmployee = new Map<string, Awaited<ReturnType<typeof getEmployeeRates>>>()
      for (const emp of employees) {
        ratesByEmployee.set(emp.uid, await getEmployeeRates(emp.uid))
      }

      const lines = buildPayrollSnapshot(
        employees.map((e) => ({ uid: e.uid, displayName: e.displayName })),
        entries,
        ratesByEmployee,
      )

      const totalGross = lines.reduce((s, l) => s + l.grossPay, 0)
      const totalHours = lines.reduce((s, l) => s + l.totalHours, 0)

      const runRef = await addDoc(collection(db, 'payrollRuns'), {
        payPeriodId: period.id,
        payPeriodStart: period.startDate,
        payPeriodEnd: period.endDate,
        status: 'preview',
        entries: lines,
        totalGross: Math.round(totalGross * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      })

      const previewRun: PayrollRun = {
        id: runRef.id,
        payPeriodId: period.id,
        payPeriodStart: period.startDate,
        payPeriodEnd: period.endDate,
        status: 'preview',
        entries: lines,
        totalGross: Math.round(totalGross * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
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
      const settings = (settingsSnap.data() ?? { companyName: 'Company' }) as CompanySettings
      const payrollSettings = payrollSnap.data() ?? {}

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
          companyName: settings.companyName,
          companyAddress: settings.address ?? '',
          lineItems: line.dayBreakdown,
          generatedAt: serverTimestamp(),
          generatedBy: user?.uid,
        })
      }

      batch.update(doc(db, 'payrollRuns', run.id), {
        status: 'finalized',
        finalizedAt: serverTimestamp(),
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
        setSuccess(`Payroll finalized. ${result.count} pay slip email(s) sent.`)
      } else {
        setSuccess('Payroll finalized and pay slips generated.')
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

  if (loading) return <LoadingSpinner />

  const displayRun = preview ?? runs.find((r) => r.status === 'preview') ?? null

  return (
    <div>
      <h1 className="page-title">Payroll Runs</h1>
      <p className="page-subtitle">Preview and finalize payroll for a pay period.</p>

      <div className="card mt-6 max-w-lg space-y-4">
        <div>
          <label htmlFor="period" className="label-field">Pay period</label>
          <select
            id="period"
            className="input-field"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
          >
            <option value="">Select a period</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.startDate} – {p.endDate} ({p.status})
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handlePreview} disabled={busy || !selectedPeriodId} className="btn-primary">
          Generate Preview
        </button>
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {success && <AlertBanner variant="success">{success}</AlertBanner>}
      </div>

      {displayRun && (
        <div className="card mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                {displayRun.payPeriodStart} – {displayRun.payPeriodEnd}
              </h2>
              <StatusBadge status={displayRun.status} />
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
                <button
                  type="button"
                  onClick={() => setFinalizeTarget(displayRun)}
                  disabled={busy}
                  className="btn-primary"
                >
                  Finalize & Generate Pay Slips
                </button>
              </div>
            )}
          </div>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">Employee</th>
                <th className="pb-2 text-right">Hours</th>
                <th className="pb-2 text-right">Gross</th>
              </tr>
            </thead>
            <tbody>
              {displayRun.entries.map((e) => (
                <tr key={e.employeeId} className="border-b border-slate-100">
                  <td className="py-2">{e.employeeName}</td>
                  <td className="py-2 text-right">{e.totalHours.toFixed(2)}</td>
                  <td className="py-2 text-right">{formatCurrency(e.grossPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-semibold">Total</td>
                <td className="pt-3 text-right font-semibold">{displayRun.totalHours.toFixed(2)}</td>
                <td className="pt-3 text-right font-bold text-brand-700">{formatCurrency(displayRun.totalGross)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Past Runs</h2>
        <ul className="mt-4 space-y-2">
          {runs.filter((r) => r.status === 'finalized').map((r) => (
            <li key={r.id} className="card flex justify-between py-3">
              <span>{r.payPeriodStart} – {r.payPeriodEnd}</span>
              <span className="font-semibold">{formatCurrency(r.totalGross)}</span>
              <Link to={`/admin/pay-slips?run=${r.id}`} className="text-brand-600 text-sm hover:underline">
                View slips
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={finalizeTarget !== null}
        title="Finalize payroll?"
        description={
          emailOnFinalize
            ? 'This will generate pay slips and email them to all employees. This action cannot be undone.'
            : 'This will generate pay slips for all employees. This action cannot be undone.'
        }
        confirmLabel="Finalize"
        busy={busy}
        onConfirm={() => finalizeTarget && void handleFinalize(finalizeTarget)}
        onCancel={() => setFinalizeTarget(null)}
      />
    </div>
  )
}
