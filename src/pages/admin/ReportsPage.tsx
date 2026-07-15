import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CompanySettings, PayrollRun } from '../../lib/types'
import { exportPayrollCsv } from '../../lib/payroll'
import { formatCurrency } from '../../lib/utils'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function ReportsPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [companyName, setCompanyName] = useState('Company')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const runSnap = await getDocs(
        query(collection(db, 'payrollRuns'), where('status', '==', 'finalized'), orderBy('createdAt', 'desc')),
      )
      const runList = runSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayrollRun)
      setRuns(runList)
      if (runList.length > 0) setSelectedRunId(runList[0].id)

      const settingsSnap = await getDoc(doc(db, 'settings', 'company'))
      if (settingsSnap.exists()) {
        setCompanyName((settingsSnap.data() as CompanySettings).companyName)
      }
      setLoading(false)
    }
    void load()
  }, [])

  const selectedRun = runs.find((r) => r.id === selectedRunId)

  const handleExport = () => {
    if (!selectedRun) return
    const csv = exportPayrollCsv(selectedRun, companyName)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${selectedRun.payPeriodStart}-${selectedRun.payPeriodEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">Export payroll data as CSV.</p>

      <div className="card mt-8 max-w-lg space-y-4">
        <div>
          <label htmlFor="run" className="label-field">Finalized payroll run</label>
          <select
            id="run"
            className="input-field"
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.payPeriodStart} – {r.payPeriodEnd}
              </option>
            ))}
          </select>
        </div>

        {selectedRun && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p>Employees: {selectedRun.entries.length}</p>
            <p>Total hours: {selectedRun.totalHours.toFixed(2)}</p>
            <p>Total gross: {formatCurrency(selectedRun.totalGross)}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={!selectedRun}
          className="btn-primary"
        >
          Export CSV
        </button>
      </div>
    </div>
  )
}
