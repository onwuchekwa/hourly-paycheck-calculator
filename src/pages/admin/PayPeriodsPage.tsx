import { useEffect, useState, type FormEvent } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PayPeriod, PayrollRun } from '../../lib/types'
import { findPaidPeriodsOverlappingRange, periodHasPayrollRuns } from '../../lib/payroll'
import { formatDisplayDate } from '../../lib/utils'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DatePicker } from '../../components/DatePicker'
import { IconButton, DeleteIcon, EditIcon } from '../../components/IconButton'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriod[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PayPeriod | null>(null)

  const load = async () => {
    const [periodSnap, runSnap] = await Promise.all([
      getDocs(query(collection(db, 'payPeriods'), orderBy('startDate', 'desc'))),
      getDocs(query(collection(db, 'payrollRuns'), orderBy('createdAt', 'desc'))),
    ])
    setPeriods(periodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayPeriod))
    setRuns(runSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PayrollRun))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const hasOpen = periods.some((p) => p.status === 'open')

  const canModifyPeriod = (period: PayPeriod) =>
    period.status === 'open' && !periodHasPayrollRuns(runs, period.id)

  const startEdit = (period: PayPeriod) => {
    setError('')
    setEditingPeriodId(period.id)
    setEditStartDate(period.startDate)
    setEditEndDate(period.endDate)
  }

  const cancelEdit = () => {
    setEditingPeriodId(null)
    setEditStartDate('')
    setEditEndDate('')
  }

  const handleSaveEdit = async (periodId: string) => {
    setError('')
    if (!editStartDate || !editEndDate || editEndDate < editStartDate) {
      setError('Valid start and end dates are required.')
      return
    }
    const period = periods.find((p) => p.id === periodId)
    if (!period || !canModifyPeriod(period)) {
      setError('This pay period can no longer be edited.')
      return
    }
    const overlapping = findPaidPeriodsOverlappingRange(
      editStartDate,
      editEndDate,
      periods,
      runs,
      periodId,
    )
    if (overlapping.length > 0) {
      const label = overlapping
        .map((p) => `${formatDisplayDate(p.startDate)} – ${formatDisplayDate(p.endDate)}`)
        .join('; ')
      setError(
        `These dates overlap a pay period that already has finalized payroll (${label}). Roll back that payroll first or choose non-overlapping dates.`,
      )
      return
    }
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'payPeriods', periodId), {
        startDate: editStartDate,
        endDate: editEndDate,
      })
      cancelEdit()
      await load()
    } catch {
      setError('Failed to update pay period.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!startDate || !endDate || endDate < startDate) {
      setError('Valid start and end dates are required.')
      return
    }
    if (hasOpen) {
      setError('Close the current open pay period before creating a new one.')
      return
    }
    const overlapping = findPaidPeriodsOverlappingRange(startDate, endDate, periods, runs)
    if (overlapping.length > 0) {
      const label = overlapping
        .map((p) => `${formatDisplayDate(p.startDate)} – ${formatDisplayDate(p.endDate)}`)
        .join('; ')
      setError(
        `These dates overlap a pay period that already has finalized payroll (${label}). Roll back that payroll first or choose non-overlapping dates.`,
      )
      return
    }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'payPeriods'), {
        startDate,
        endDate,
        status: 'open',
        createdAt: serverTimestamp(),
      })
      setStartDate('')
      setEndDate('')
      await load()
    } catch {
      setError('Failed to create pay period.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (period: PayPeriod) => {
    setError('')
    if (!canModifyPeriod(period)) {
      setError('This pay period can no longer be deleted.')
      return
    }
    setSubmitting(true)
    try {
      await deleteDoc(doc(db, 'payPeriods', period.id))
      if (editingPeriodId === period.id) cancelEdit()
      setDeleteTarget(null)
      await load()
    } catch {
      setError('Failed to delete pay period.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async (id: string) => {
    await updateDoc(doc(db, 'payPeriods', id), {
      status: 'closed',
      closedAt: serverTimestamp(),
    })
    await load()
  }

  const handleReopen = async (id: string) => {
    setError('')
    if (periods.some((p) => p.status === 'open')) {
      setError('Close the current open pay period before reopening another.')
      return
    }
    await updateDoc(doc(db, 'payPeriods', id), {
      status: 'open',
      closedAt: deleteField(),
    })
    await load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Pay Periods</h1>
      <p className="page-subtitle">
        Manage pay periods — only one can be open at a time. Reopen a closed period to run supplemental payroll.
      </p>

      {error && (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {!hasOpen && (
        <form onSubmit={handleCreate} className="card mt-6 max-w-lg space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <DatePicker label="Start date" value={startDate} onChange={setStartDate} required />
          <DatePicker label="End date" value={endDate} onChange={setEndDate} required />
          <button type="submit" disabled={submitting} className="btn-primary">
            Create Pay Period
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {periods.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center justify-between gap-4">
            {editingPeriodId === p.id ? (
              <div className="w-full max-w-lg space-y-4">
                <p className="font-semibold text-slate-900">Edit pay period</p>
                <DatePicker label="Start date" value={editStartDate} onChange={setEditStartDate} required />
                <DatePicker label="End date" value={editEndDate} onChange={setEditEndDate} required />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSaveEdit(p.id)}
                    className="btn-primary text-xs"
                  >
                    Save
                  </button>
                  <button type="button" disabled={submitting} onClick={cancelEdit} className="btn-secondary text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-semibold">{p.startDate} – {p.endDate}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canModifyPeriod(p) && (
                    <>
                      <IconButton label="Edit pay period" onClick={() => startEdit(p)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        label="Delete pay period"
                        variant="danger"
                        disabled={submitting}
                        onClick={() => setDeleteTarget(p)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                  {p.status === 'open' && (
                    <button type="button" onClick={() => handleClose(p.id)} className="btn-secondary text-xs">
                      Close Period
                    </button>
                  )}
                  {p.status === 'closed' && (
                    <button type="button" onClick={() => handleReopen(p.id)} className="btn-secondary text-xs">
                      Reopen Period
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete pay period?"
        description={
          deleteTarget
            ? `Permanently delete ${formatDisplayDate(deleteTarget.startDate)} – ${formatDisplayDate(deleteTarget.endDate)}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={submitting}
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
