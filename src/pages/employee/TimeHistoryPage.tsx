import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import {
  canDeleteEntry,
  formatEntryDuration,
  formatPunchDuration,
  getPunches,
  normalizeEntry,
  punchesToFirestore,
  removePunchAtIndex,
} from '../../lib/timeEntries'
import { formatDisplayDate, formatTime } from '../../lib/utils'
import { EmptyState, PageHeader } from '../../components/ui'
import { AlertBanner } from '../../components/AlertBanner'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DeleteIcon, EditIcon, IconButton, iconLinkClassName } from '../../components/IconButton'

interface DeleteSessionTarget {
  entry: TimeEntry
  punchIndex: number
}

export function TimeHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteSessionTarget | null>(null)
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

  const handleDeleteSession = async () => {
    if (!deleteTarget) return
    setBusy(true)
    setError('')
    try {
      const { entry, punchIndex } = deleteTarget
      const remaining = removePunchAtIndex(entry, punchIndex)
      if (remaining.length === 0) {
        await deleteDoc(doc(db, 'timeEntries', entry.id))
      } else {
        await updateDoc(doc(db, 'timeEntries', entry.id), {
          punches: punchesToFirestore(remaining),
          clockIn: null,
          clockOut: null,
          updatedAt: serverTimestamp(),
        })
      }
      setDeleteTarget(null)
      await load()
    } catch {
      setError('Failed to delete session.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="Time History" subtitle="All your recorded time entries." />

      {error && <AlertBanner variant="error" className="mt-6">{error}</AlertBanner>}

      {entries.length === 0 ? (
        <div className="mt-6 sm:mt-8">
          <EmptyState
            title="No time entries yet"
            description="Clock in on the timesheet to start recording your hours."
            action={
              <Link to="/employee/timesheet" className="btn-primary">
                Go to Timesheet
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 stack-cards sm:mt-8">
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
                      <Link
                        to="/employee/timesheet"
                        state={{ workDate: e.workDate }}
                        className="btn-secondary text-xs"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
                {punches.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
                    {punches.map((punch, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 text-slate-700">
                        <span>
                          {formatTime(punch.clockIn)} – {punch.clockOut ? formatTime(punch.clockOut) : 'Open'}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{formatPunchDuration(punch)}</span>
                          {deletable && (
                            <>
                              <Link
                                to="/employee/timesheet"
                                state={{ workDate: e.workDate }}
                                aria-label={`Edit session ${index + 1}`}
                                title={`Edit session ${index + 1}`}
                                className={iconLinkClassName()}
                              >
                                <EditIcon />
                              </Link>
                              <IconButton
                                label={`Delete session ${index + 1}`}
                                variant="danger"
                                disabled={busy}
                                onClick={() => setDeleteTarget({ entry: e, punchIndex: index })}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </div>
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
        title="Delete session?"
        description={
          deleteTarget
            ? `This will permanently remove session ${deleteTarget.punchIndex + 1} on ${formatDisplayDate(deleteTarget.entry.workDate)}.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
