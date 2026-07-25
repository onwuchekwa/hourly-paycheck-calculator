import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import {
  canDeleteEntry,
  formatEntryDuration,
  formatPunchDuration,
  getPunches,
  normalizeEntry,
} from '../../lib/timeEntries'
import { formatDisplayDate, formatTime } from '../../lib/utils'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ConfirmDialog } from '../../components/ConfirmDialog'

export function TimeHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    if (!profile) return
    setLoading(true)
    const q = query(
      collection(db, 'timeEntries'),
      where('employeeId', '==', profile.uid),
      orderBy('workDate', 'desc'),
    )
    const snap = await getDocs(q)
    setEntries(
      snap.docs.map((d) => normalizeEntry({ id: d.id, ...d.data() } as TimeEntry)),
    )
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [profile])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    setError('')
    try {
      await deleteDoc(doc(db, 'timeEntries', deleteTarget.id))
      setDeleteTarget(null)
      await load()
    } catch {
      setError('Failed to delete entry.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Time History</h1>
      <p className="page-subtitle">All your recorded time entries.</p>

      {error && (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="mt-8 text-slate-600">No time entries yet.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {entries.map((e) => {
            const punches = getPunches(e)
            const deletable = canDeleteEntry(e)
            return (
              <div key={e.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{formatDisplayDate(e.workDate)}</p>
                    <p className="text-sm text-slate-600">
                      {punches.length} session{punches.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-brand-700">{formatEntryDuration(e)}</span>
                    <StatusBadge status={e.status} />
                    {deletable && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(e)}
                        disabled={busy}
                        className="btn-danger text-xs"
                      >
                        Delete
                      </button>
                    )}
                    {deletable && (
                      <Link to="/employee/timesheet" state={{ workDate: e.workDate }} className="btn-secondary text-xs">
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
                {punches.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                    {punches.map((punch, index) => (
                      <li key={index} className="flex justify-between text-slate-700">
                        <span>
                          {formatTime(punch.clockIn)} – {punch.clockOut ? formatTime(punch.clockOut) : 'Open'}
                        </span>
                        <span className="font-medium">{formatPunchDuration(punch)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete time entry?"
        description={
          deleteTarget
            ? `This will permanently remove all sessions for ${formatDisplayDate(deleteTarget.workDate)}.`
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
