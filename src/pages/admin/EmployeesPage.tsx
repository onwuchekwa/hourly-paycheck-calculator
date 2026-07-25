import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { apiPost, isApiConfigured } from '../../lib/api'
import { db } from '../../lib/firebase'
import type { EmployeeRate, UserProfile } from '../../lib/types'
import { formatCurrency, todayString } from '../../lib/utils'
import { getCallableErrorMessage } from '../../lib/errors'
import { AlertBanner } from '../../components/AlertBanner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { PageHeader, ResponsiveTable, type ResponsiveTableColumn } from '../../components/ui'

export function EmployeesPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rateEmployee, setRateEmployee] = useState<UserProfile | null>(null)
  const [newRate, setNewRate] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayString())
  const [rateHistory, setRateHistory] = useState<EmployeeRate[]>([])
  const [deactivateTarget, setDeactivateTarget] = useState<UserProfile | null>(null)

  const loadEmployees = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'employee'),
        orderBy('displayName'),
      )
      const snap = await getDocs(q)
      setEmployees(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile))
    } catch {
      setError('Failed to load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEmployees()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return employees
    return employees.filter(
      (e) =>
        e.displayName.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term),
    )
  }, [employees, search])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const rate = parseFloat(hourlyRate)
    if (!displayName || !email || Number.isNaN(rate) || rate <= 0) {
      setError('Please fill all fields with valid values.')
      return
    }
    setSubmitting(true)
    try {
      const result = await apiPost<{ uid: string; email: string; mailWarning?: string }>('/api/employees', {
        displayName: displayName.trim(),
        email: email.trim(),
        hourlyRate: rate,
      })
      if (result.mailWarning) {
        setSuccess(
          `Employee created, but the welcome email could not be sent: ${result.mailWarning} Share sign-in credentials with them manually.`,
        )
      } else {
        setSuccess(`Employee created. A welcome email with sign-in instructions was sent to ${email.trim()}.`)
      }
      setDisplayName('')
      setEmail('')
      setHourlyRate('')
      setShowForm(false)
      await loadEmployees()
    } catch (err) {
      setError(getCallableErrorMessage(err, 'Failed to create employee.'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (emp: UserProfile) => {
    const active = emp.active !== false
    try {
      await updateDoc(doc(db, 'users', emp.uid), {
        active: !active,
        status: active ? 'inactive' : 'active',
        updatedAt: serverTimestamp(),
      })
      setDeactivateTarget(null)
      await loadEmployees()
    } catch {
      setError(`Failed to ${active ? 'deactivate' : 'reactivate'} employee.`)
    }
  }

  const openRateModal = async (emp: UserProfile) => {
    setRateEmployee(emp)
    setNewRate(String(emp.currentHourlyRate ?? ''))
    setEffectiveFrom(todayString())
    const q = query(
      collection(db, 'employeeRates'),
      where('employeeId', '==', emp.uid),
      orderBy('effectiveFrom', 'desc'),
    )
    const snap = await getDocs(q)
    setRateHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EmployeeRate))
  }

  const handleRateChange = async (e: FormEvent) => {
    e.preventDefault()
    if (!rateEmployee || !user) return
    const rate = parseFloat(newRate)
    if (Number.isNaN(rate) || rate <= 0 || !effectiveFrom) {
      setError('Enter a valid rate and effective date.')
      return
    }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'employeeRates'), {
        employeeId: rateEmployee.uid,
        employeeName: rateEmployee.displayName,
        hourlyRate: rate,
        effectiveFrom,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })
      if (effectiveFrom <= todayString()) {
        await updateDoc(doc(db, 'users', rateEmployee.uid), {
          currentHourlyRate: rate,
          updatedAt: serverTimestamp(),
        })
      }
      setRateEmployee(null)
      await loadEmployees()
    } catch {
      setError('Failed to update rate.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const employeeColumns: ResponsiveTableColumn<UserProfile>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => <span className="font-medium">{e.displayName}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (e) => e.email,
    },
    {
      key: 'rate',
      header: 'Current rate',
      mobileLabel: 'Rate',
      render: (e) => `${formatCurrency(e.currentHourlyRate ?? 0)}/hr`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (e.active !== false ? 'Active' : 'Inactive'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (e) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openRateModal(e)} className="btn-secondary text-xs">
            Change rate
          </button>
          <button
            type="button"
            onClick={() => (e.active !== false ? setDeactivateTarget(e) : toggleActive(e))}
            className="btn-secondary text-xs"
          >
            {e.active !== false ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Create and manage employee accounts and hourly rates."
        actions={
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'Add Employee'}
          </button>
        }
      />

      {!isApiConfigured() && (
        <AlertBanner variant="error" className="mt-6">
          Employee creation requires the Node API. Set <code className="rounded bg-white px-1">VITE_API_URL</code> in{' '}
          <code className="rounded bg-white px-1">.env</code>, run{' '}
          <code className="rounded bg-white px-1">npm run dev:app</code>, and configure SMTP in{' '}
          <code className="rounded bg-white px-1">server/.env</code>.
        </AlertBanner>
      )}

      <div className="mt-6">
        <label htmlFor="search" className="label-field">Search employees</label>
        <input
          id="search"
          type="search"
          className="input-field max-w-md"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mt-6 max-w-lg space-y-4">
          {error && <AlertBanner variant="error">{error}</AlertBanner>}
          {success && <AlertBanner variant="success">{success}</AlertBanner>}
          <div>
            <label htmlFor="name" className="label-field">Full name</label>
            <input id="name" className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="emp-email" className="label-field">Email (username)</label>
            <input id="emp-email" type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="rate" className="label-field">Starting hourly rate ($)</label>
            <input id="rate" type="number" step="0.01" min="0" className="input-field" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating…' : 'Create Employee'}
          </button>
        </form>
      )}

      <div className="mt-8">
        <ResponsiveTable
          columns={employeeColumns}
          rows={filtered}
          keyField="uid"
          emptyMessage="No employees match your search."
        />
      </div>

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate employee?"
        description={`${deactivateTarget?.displayName} will no longer be able to sign in or appear in new payroll runs.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => deactivateTarget && void toggleActive(deactivateTarget)}
        onCancel={() => setDeactivateTarget(null)}
      />

      {rateEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleRateChange} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="text-lg font-semibold">Change rate — {rateEmployee.displayName}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="new-rate" className="label-field">New hourly rate ($)</label>
                <input id="new-rate" type="number" step="0.01" min="0" className="input-field" value={newRate} onChange={(e) => setNewRate(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="effective-from" className="label-field">Effective from</label>
                <input id="effective-from" type="date" className="input-field" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
              </div>
              {rateHistory.length > 0 && (
                <div>
                  <p className="label-field">Rate history</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-600">
                    {rateHistory.map((r) => (
                      <li key={r.id}>{r.effectiveFrom}: {formatCurrency(r.hourlyRate)}/hr</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">Save rate</button>
              <button type="button" onClick={() => setRateEmployee(null)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
