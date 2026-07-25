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
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import {
  formatEntryDuration,
  formatPunchDuration,
  getPunches,
  normalizeEntry,
} from '../../lib/timeEntries'
import { formatDisplayDate, formatTime } from '../../lib/utils'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function TimeReviewPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filter, setFilter] = useState<'submitted' | 'all'>('submitted')
  const [loading, setLoading] = useState(true)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    setError('')
    try {
      await updateDoc(doc(db, 'timeEntries', id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid,
        updatedAt: serverTimestamp(),
      })
      await load()
    } catch {
      setError('Failed to approve entry.')
    } finally {
      setBusy(false)
    }
  }

  const handleBulkApprove = async () => {
    const submitted = entries.filter((e) => e.status === 'submitted')
    if (submitted.length === 0) return
    setBusy(true)
    setError('')
    try {
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
    } catch {
      setError('Failed to approve entries.')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (id: string) => {
    const reason = rejectReasons[id]?.trim()
    if (!reason) return
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(db, 'timeEntries', id), {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid,
        updatedAt: serverTimestamp(),
      })
      setRejectReasons((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      await load()
    } catch {
      setError('Failed to reject entry.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Time Review</h1>
      <p className="page-subtitle">Approve or reject employee time entries.</p>

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

      {error && (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {entries.length === 0 ? (
          <p className="text-slate-600">No entries to review.</p>
        ) : (
          entries.map((e) => {
            const punches = getPunches(e)
            const rejectReason = rejectReasons[e.id] ?? ''
            return (
              <div key={e.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.employeeName}</p>
                    <p className="text-sm text-slate-600">{formatDisplayDate(e.workDate)}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>

                {e.rejectionReason && (
                  <p className="mt-2 text-sm text-red-700">Rejected: {e.rejectionReason}</p>
                )}

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

                {e.status === 'submitted' && (
                  <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => handleApprove(e.id)}
                      disabled={busy}
                      className="btn-primary text-xs"
                    >
                      Approve
                    </button>
                    <div className="min-w-[12rem] flex-1">
                      <label htmlFor={`reject-${e.id}`} className="sr-only">
                        Rejection reason for {e.employeeName}
                      </label>
                      <input
                        id={`reject-${e.id}`}
                        type="text"
                        placeholder="Rejection reason (required)"
                        className="input-field text-xs"
                        value={rejectReason}
                        onChange={(ev) =>
                          setRejectReasons((current) => ({ ...current, [e.id]: ev.target.value }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReject(e.id)}
                      disabled={busy || !rejectReason.trim()}
                      className="btn-danger text-xs"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
