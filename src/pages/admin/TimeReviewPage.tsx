import { useEffect, useState } from 'react'
import {
  collection,
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
  calcHours,
  formatDisplayDate,
  formatTime,
  timestampToInputValue,
  inputValueToDate,
} from '../../lib/utils'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function TimeReviewPage() {
  const { profile, user } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filter, setFilter] = useState<'submitted' | 'all'>('submitted')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [editReason, setEditReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const constraints = filter === 'submitted'
      ? [where('status', '==', 'submitted')]
      : []
    const q = query(collection(db, 'timeEntries'), ...constraints, orderBy('workDate', 'desc'))
    const snap = await getDocs(q)
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry))
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
    const inDate = inputValueToDate(editIn)
    const outDate = inputValueToDate(editOut)
    if (!inDate || !outDate || outDate <= inDate) return
    setBusy(true)
    const historyEntry = {
      editedAt: Timestamp.now(),
      editedBy: user!.uid,
      editedByName: profile!.displayName,
      reason: editReason.trim(),
      previousClockIn: entry.clockIn ? timestampToInputValue(entry.clockIn) : null,
      previousClockOut: entry.clockOut ? timestampToInputValue(entry.clockOut) : null,
      newClockIn: editIn,
      newClockOut: editOut,
    }
    await updateDoc(doc(db, 'timeEntries', entry.id), {
      clockIn: Timestamp.fromDate(inDate),
      clockOut: Timestamp.fromDate(outDate),
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
    setEditIn(timestampToInputValue(entry.clockIn))
    setEditOut(timestampToInputValue(entry.clockOut))
    setEditReason('')
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
          entries.map((e) => (
            <div key={e.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{e.employeeName}</p>
                  <p className="text-sm text-slate-600">{formatDisplayDate(e.workDate)}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-2 text-sm">
                {formatTime(e.clockIn)} – {formatTime(e.clockOut)} ({calcHours(e.clockIn, e.clockOut).toFixed(2)} hrs)
              </p>

              {editingId === e.id ? (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <input type="datetime-local" className="input-field" value={editIn} onChange={(ev) => setEditIn(ev.target.value)} />
                  <input type="datetime-local" className="input-field" value={editOut} onChange={(ev) => setEditOut(ev.target.value)} />
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
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
