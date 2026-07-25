import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import {
  canDeleteEntry,
  formatEntryDuration,
  formatPunchDuration,
  getPunches,
  normalizeEntry,
  parseEditRows,
  punchesToEditRows,
  punchesToFirestore,
  serializePunchesForHistory,
  type EditPunchRow,
} from '../../lib/timeEntries'
import { formatDisplayDate, formatTime } from '../../lib/utils'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ConfirmDialog } from '../../components/ConfirmDialog'

export function TimeReviewPage() {
  const { profile, user } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filter, setFilter] = useState<'submitted' | 'all'>('submitted')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRows, setEditRows] = useState<EditPunchRow[]>([{ clockIn: '', clockOut: '' }])
  const [editReason, setEditReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null)

  const load = async () => {
    setLoading(true)
    const constraints = filter === 'submitted'
      ? [where('status', '==', 'submitted')]
      : []
    const q = query(collection(db, 'timeEntries'), ...constraints, orderBy('workDate', 'desc'))
    const snap = await getDocs(q)
    setEntries(snap.docs.map((d) => normalizeEntry({ id: d.id, ...d.data() } as TimeEntry)))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [filter])

  const handleApprove = async (id: string) => {
    setBusy(true)
    await updateDoc(doc(db, 'timeEntries', id), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      reviewedBy: user?.uid,
      updatedAt: serverTimestamp(),
    })
    await load()
    setBusy(false)
  }

  const handleBulkApprove = async () => {
    const submitted = entries.filter((e) => e.status === 'submitted')
    if (submitted.length === 0) return
    setBusy(true)
    await Promise.all(
      submitted.map((e) =>
        updateDoc(doc(db, 'timeEntries', e.id), {
          status: 'approved',
          approvedAt: serverTimestamp(),
          reviewedAt: serverTimestamp(),
          reviewedBy: user?.uid,
          updatedAt: serverTimestamp(),
        }),
      ),
    )
    await load()
    setBusy(false)
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return
    setBusy(true)
    await updateDoc(doc(db, 'timeEntries', id), {
      status: 'rejected',
      rejectionReason: rejectReason.trim(),
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setRejectReason('')
    await load()
    setBusy(false)
  }

  const handleReturnToDraft = async (id: string) => {
    setBusy(true)
    await updateDoc(doc(db, 'timeEntries', id), {
      status: 'draft',
      rejectionReason: null,
      updatedAt: serverTimestamp(),
    })
    await load()
    setBusy(false)
  }

  const handleEdit = async (entry: TimeEntry) => {
    if (editReason.trim().length < 10) return
    const parsed = parseEditRows(editRows)
    if (!parsed.ok) return
    setBusy(true)
    const previousPunches = getPunches(entry)
    const historyEntry = {
      editedAt: Timestamp.now(),
      editedBy: user!.uid,
      editedByName: profile!.displayName,
      reason: editReason.trim(),
      previousPunches: serializePunchesForHistory(previousPunches),
      newPunches: serializePunchesForHistory(parsed.punches),
    }
    await updateDoc(doc(db, 'timeEntries', entry.id), {
      punches: punchesToFirestore(parsed.punches),
      clockIn: null,
      clockOut: null,
      punchSource: 'manual_edit',
      editHistory: [...(entry.editHistory ?? []), historyEntry],
      updatedAt: serverTimestamp(),
    })
    setEditingId(null)
    setEditReason('')
    await load()
    setBusy(false)
  }

  const startEdit = (entry: TimeEntry) => {
    setEditingId(entry.id)
    setEditRows(punchesToEditRows(entry))
    setEditReason('')
  }

  const updateEditRow = (index: number, field: 'clockIn' | 'clockOut', value: string) => {
    setEditRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const addEditRow = () => {
    setEditRows((rows) => [...rows, { clockIn: '', clockOut: '' }])
  }

  const removeEditRow = (index: number) => {
    setEditRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    await deleteDoc(doc(db, 'timeEntries', deleteTarget.id))
    setDeleteTarget(null)
    await load()
    setBusy(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Time Review</h1>
      <p className="page-subtitle">Approve, reject, or edit employee time entries.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('submitted')}
          className={filter === 'submitted' ? 'btn-primary' : 'btn-secondary'}
        >
          Submitted
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'btn-primary' : 'btn-secondary'}
        >
          All Entries
        </button>
        {filter === 'submitted' && entries.length > 0 && (
          <button type="button" onClick={handleBulkApprove} disabled={busy} className="btn-secondary">
            Approve all submitted
          </button>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {entries.length === 0 ? (
          <p className="text-slate-600">No entries to review.</p>
        ) : (
          entries.map((e) => {
            const punches = getPunches(e)
            return (
              <div key={e.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.employeeName}</p>
                    <p className="text-sm text-slate-600">{formatDisplayDate(e.workDate)}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>

                {punches.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No sessions recorded.</p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {punches.map((punch, index) => (
                      <li key={index} className="flex justify-between text-slate-700">
                        <span>
                          {formatTime(punch.clockIn)} – {punch.clockOut ? formatTime(punch.clockOut) : 'Open'}
                        </span>
                        <span className="font-medium">{formatPunchDuration(punch)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                      <span>Total</span>
                      <span>{formatEntryDuration(e)}</span>
                    </li>
                  </ul>
                )}

                {editingId === e.id ? (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {editRows.map((row, index) => (
                      <div key={index} className="space-y-2 rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">Session {index + 1}</span>
                          {editRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditRow(index)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={row.clockIn}
                          onChange={(ev) => updateEditRow(index, 'clockIn', ev.target.value)}
                        />
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={row.clockOut}
                          onChange={(ev) => updateEditRow(index, 'clockOut', ev.target.value)}
                        />
                      </div>
                    ))}
                    <button type="button" onClick={addEditRow} className="btn-secondary text-xs">
                      Add session
                    </button>
                    <textarea
                      className="input-field min-h-16"
                      placeholder="Reason (min 10 chars)"
                      value={editReason}
                      onChange={(ev) => setEditReason(ev.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(e)} disabled={busy} className="btn-primary text-xs">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {e.status === 'submitted' && (
                      <>
                        <button type="button" onClick={() => handleApprove(e.id)} disabled={busy} className="btn-primary text-xs">Approve</button>
                        <input
                          type="text"
                          placeholder="Rejection reason"
                          className="input-field max-w-xs text-xs"
                          value={rejectReason}
                          onChange={(ev) => setRejectReason(ev.target.value)}
                        />
                        <button type="button" onClick={() => handleReject(e.id)} disabled={busy} className="btn-danger text-xs">Reject</button>
                      </>
                    )}
                    {e.status === 'rejected' && (
                      <button type="button" onClick={() => handleReturnToDraft(e.id)} disabled={busy} className="btn-secondary text-xs">
                        Return to Draft
                      </button>
                    )}
                    <button type="button" onClick={() => startEdit(e)} disabled={busy} className="btn-secondary text-xs">Edit</button>
                    {canDeleteEntry(e) && (
                      <button type="button" onClick={() => setDeleteTarget(e)} disabled={busy} className="btn-danger text-xs">
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete time entry?"
        description={
          deleteTarget
            ? `This will permanently remove all sessions for ${deleteTarget.employeeName} on ${formatDisplayDate(deleteTarget.workDate)}.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
