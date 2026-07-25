import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import {
  autoCloseStalePunches,
  canEditEntry,
  canSubmitForReview,
  createClockInTimestamp,
  createClockOutTimestamp,
  fetchEmployeeEntries,
  findGlobalOpenPunch,
  formatEntryDuration,
  formatPunchDuration,
  getOpenPunch,
  getPunches,
  normalizeEntry,
  parseSinglePunchEdit,
  punchToEditRow,
  punchesToFirestoreForWorkDate,
  removePunchAtIndex,
  replacePunchAtIndex,
  serializePunchesForHistory,
} from '../../lib/timeEntries'
import {
  formatDate,
  formatDisplayDate,
  formatTime,
  timeEntryDocId,
} from '../../lib/utils'
import { DatePicker } from '../../components/DatePicker'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DeleteIcon, EditIcon, IconButton } from '../../components/IconButton'

export function TimesheetPage() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const [workDate, setWorkDate] = useState(formatDate(new Date()))
  const [entry, setEntry] = useState<TimeEntry | null>(null)
  const [globalOpenEntryId, setGlobalOpenEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editingPunchIndex, setEditingPunchIndex] = useState<number | null>(null)
  const [sessionEditRow, setSessionEditRow] = useState({ clockIn: '', clockOut: '' })
  const [editReason, setEditReason] = useState('')
  const [deleteSessionIndex, setDeleteSessionIndex] = useState<number | null>(null)

  const employeeId = profile?.uid ?? ''
  const docId = timeEntryDocId(employeeId, workDate)
  const normalizedEntry = entry ? normalizeEntry(entry) : null
  const punches = getPunches(normalizedEntry)
  const readOnly = entry ? !canEditEntry(entry) : false
  const hasGlobalOpen = globalOpenEntryId !== null
  const openOnThisDay = normalizedEntry ? getOpenPunch(normalizedEntry) !== null : false
  const showClockIn = !readOnly && !hasGlobalOpen
  const showClockOut = !readOnly && hasGlobalOpen

  const refreshGlobalOpen = async () => {
    if (!employeeId) return
    const entries = await fetchEmployeeEntries(employeeId)
    const open = findGlobalOpenPunch(entries)
    setGlobalOpenEntryId(open?.entryId ?? null)
  }

  const loadEntry = async () => {
    if (!employeeId) return
    setLoading(true)
    setError('')
    try {
      await autoCloseStalePunches(employeeId)
      const snap = await getDoc(doc(db, 'timeEntries', docId))
      if (snap.exists()) {
        setEntry(normalizeEntry({ id: snap.id, ...snap.data() } as TimeEntry))
      } else {
        setEntry(null)
      }
      await refreshGlobalOpen()
      setEditingPunchIndex(null)
    } catch {
      setError('Unable to load timesheet. Please try again or contact your employer.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const stateDate = (location.state as { workDate?: string } | null)?.workDate
    if (stateDate) setWorkDate(stateDate)
  }, [location.state])

  useEffect(() => {
    void loadEntry()
  }, [employeeId, docId, workDate])

  const ensureEntry = async (): Promise<TimeEntry> => {
    const ref = doc(db, 'timeEntries', docId)
    const snap = await getDoc(ref)
    if (snap.exists()) return normalizeEntry({ id: snap.id, ...snap.data() } as TimeEntry)

    const newEntry: Omit<TimeEntry, 'id'> = {
      employeeId,
      employeeName: profile?.displayName ?? '',
      workDate,
      status: 'draft',
      punches: [],
    }
    await setDoc(ref, { ...newEntry, updatedAt: serverTimestamp() })
    return { id: docId, ...newEntry }
  }

  const handleClockIn = async () => {
    setBusy(true)
    setError('')
    try {
      await autoCloseStalePunches(employeeId)
      const entries = await fetchEmployeeEntries(employeeId)
      const open = findGlobalOpenPunch(entries)
      if (open) {
        const dateLabel = formatDisplayDate(open.entry.workDate)
        setError(`Clock out your open session from ${dateLabel} before starting a new one.`)
        setGlobalOpenEntryId(open.entryId)
        return
      }

      const current = await ensureEntry()
      const currentPunches = getPunches(current)
      await updateDoc(doc(db, 'timeEntries', docId), {
        punches: punchesToFirestoreForWorkDate(workDate, [
          ...currentPunches,
          { clockIn: createClockInTimestamp(workDate), clockOut: null },
        ]),
        clockIn: null,
        clockOut: null,
        punchSource: 'button',
        updatedAt: serverTimestamp(),
      })
      await loadEntry()
    } catch {
      setError('Failed to clock in.')
    } finally {
      setBusy(false)
    }
  }

  const handleClockOut = async () => {
    setBusy(true)
    setError('')
    try {
      const entries = await fetchEmployeeEntries(employeeId)
      const open = findGlobalOpenPunch(entries)
      if (!open) {
        setError('No open clock-in session found.')
        setGlobalOpenEntryId(null)
        return
      }

      const punches = [...getPunches(open.entry)]
      punches[open.punchIndex] = {
        ...punches[open.punchIndex],
        clockOut: createClockOutTimestamp(open.entry.workDate),
      }

      await updateDoc(doc(db, 'timeEntries', open.entryId), {
        punches: punchesToFirestoreForWorkDate(open.entry.workDate, punches),
        clockIn: null,
        clockOut: null,
        punchSource: 'button',
        updatedAt: serverTimestamp(),
      })
      await loadEntry()
    } catch {
      setError('Failed to clock out.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!normalizedEntry || !canSubmitForReview(normalizedEntry)) {
      setError('Complete all sessions before submitting.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(db, 'timeEntries', docId), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        rejectionReason: null,
        rejectedAt: null,
        updatedAt: serverTimestamp(),
      })
      await loadEntry()
    } catch {
      setError('Failed to submit entry.')
    } finally {
      setBusy(false)
    }
  }

  const openSessionEdit = (index: number) => {
    const punch = punches[index]
    if (!punch) return
    setEditingPunchIndex(index)
    setSessionEditRow(punchToEditRow(punch, workDate))
    setEditReason('')
  }

  const cancelSessionEdit = () => {
    setEditingPunchIndex(null)
    setSessionEditRow({ clockIn: '', clockOut: '' })
    setEditReason('')
  }

  const handleSessionEdit = async () => {
    if (editingPunchIndex === null || !normalizedEntry) return
    if (editReason.trim().length < 10) {
      setError('Edit reason must be at least 10 characters.')
      return
    }
    const currentPunch = punches[editingPunchIndex]
    const allowOpenOut = currentPunch ? !currentPunch.clockOut : false
    const parsed = parseSinglePunchEdit(sessionEditRow, allowOpenOut)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const replaced = replacePunchAtIndex(normalizedEntry, editingPunchIndex, parsed.punch)
    if (!replaced.ok) {
      setError(replaced.error)
      return
    }
    setBusy(true)
    setError('')
    try {
      const previousPunches = getPunches(normalizedEntry)
      const historyEntry = {
        editedAt: Timestamp.now(),
        editedBy: user!.uid,
        editedByName: profile!.displayName,
        reason: editReason.trim(),
        previousPunches: serializePunchesForHistory(previousPunches),
        newPunches: serializePunchesForHistory(replaced.punches),
      }
      await updateDoc(doc(db, 'timeEntries', docId), {
        punches: punchesToFirestoreForWorkDate(workDate, replaced.punches),
        clockIn: null,
        clockOut: null,
        punchSource: 'manual_edit',
        editHistory: [...(entry?.editHistory ?? []), historyEntry],
        updatedAt: serverTimestamp(),
      })
      cancelSessionEdit()
      await loadEntry()
    } catch {
      setError('Failed to save edit.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSession = async () => {
    if (deleteSessionIndex === null || !normalizedEntry || !entry) return
    setBusy(true)
    setError('')
    try {
      const remaining = removePunchAtIndex(normalizedEntry, deleteSessionIndex)
      if (remaining.length === 0) {
        await deleteDoc(doc(db, 'timeEntries', docId))
        setEntry(null)
      } else {
        await updateDoc(doc(db, 'timeEntries', docId), {
          punches: punchesToFirestoreForWorkDate(workDate, remaining),
          clockIn: null,
          clockOut: null,
          updatedAt: serverTimestamp(),
        })
      }
      setDeleteSessionIndex(null)
      cancelSessionEdit()
      await refreshGlobalOpen()
      if (remaining.length > 0) await loadEntry()
    } catch {
      setError('Failed to delete session.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Timesheet</h1>
      <p className="page-subtitle">Record your work hours for each day.</p>

      <div className="mt-8 max-w-lg space-y-6">
        <DatePicker
          label="Work date"
          value={workDate}
          onChange={setWorkDate}
          required
        />

        {entry && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Status:</span>
            <StatusBadge status={entry.status} />
          </div>
        )}

        {entry?.rejectionReason && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            Rejected: {entry.rejectionReason}
          </div>
        )}

        {hasGlobalOpen && globalOpenEntryId !== docId && (
          <div role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have an open session on another date. Use Clock Out to close it before starting a new session.
          </div>
        )}

        <div className="card space-y-4">
          {punches.length === 0 ? (
            <p className="text-sm text-slate-600">No time recorded for this date yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Sessions</span>
                <span>Duration</span>
              </div>
              {punches.map((punch, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium">{formatTime(punch.clockIn)}</span>
                      <span className="text-slate-400"> – </span>
                      <span className="font-medium">
                        {punch.clockOut ? formatTime(punch.clockOut) : 'Open'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-800">{formatPunchDuration(punch)}</span>
                      {!readOnly && (
                        <>
                          <IconButton
                            label={`Edit session ${index + 1}`}
                            onClick={() => openSessionEdit(index)}
                            disabled={busy}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            label={`Delete session ${index + 1}`}
                            variant="danger"
                            onClick={() => setDeleteSessionIndex(index)}
                            disabled={busy}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                  {editingPunchIndex === index && !readOnly && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-700">Edit session {index + 1}</p>
                      <div>
                        <label htmlFor={`session-in-${index}`} className="label-field">Clock in</label>
                        <input
                          id={`session-in-${index}`}
                          type="datetime-local"
                          className="input-field"
                          value={sessionEditRow.clockIn}
                          onChange={(e) => setSessionEditRow((row) => ({ ...row, clockIn: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor={`session-out-${index}`} className="label-field">Clock out</label>
                        <input
                          id={`session-out-${index}`}
                          type="datetime-local"
                          className="input-field"
                          value={sessionEditRow.clockOut}
                          onChange={(e) => setSessionEditRow((row) => ({ ...row, clockOut: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor={`session-reason-${index}`} className="label-field">
                          Reason for edit (min 10 characters)
                        </label>
                        <textarea
                          id={`session-reason-${index}`}
                          className="input-field min-h-16"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          minLength={10}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSessionEdit} disabled={busy} className="btn-primary text-xs">
                          Save
                        </button>
                        <button type="button" onClick={cancelSessionEdit} disabled={busy} className="btn-secondary text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-600">Daily total</span>
                <span className="text-lg font-bold text-brand-700">
                  {normalizedEntry ? formatEntryDuration(normalizedEntry) : '—'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {showClockIn && (
                <button type="button" onClick={handleClockIn} disabled={busy} className="btn-primary">
                  Clock In
                </button>
              )}
              {showClockOut && (
                <button type="button" onClick={handleClockOut} disabled={busy} className="btn-primary">
                  Clock Out{openOnThisDay ? '' : ' (open session)'}
                </button>
              )}
              {normalizedEntry && canSubmitForReview(normalizedEntry) && (
                <button type="button" onClick={handleSubmit} disabled={busy} className="btn-secondary">
                  {entry?.status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
                </button>
              )}
            </div>
          )}
        </div>

        {readOnly && (
          <p className="text-sm text-slate-600">
            This entry is {entry?.status} and cannot be edited.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleteSessionIndex !== null}
        title="Delete session?"
        description={
          deleteSessionIndex !== null
            ? `This will permanently remove session ${deleteSessionIndex + 1} on ${formatDisplayDate(workDate)}.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteSessionIndex(null)}
      />
    </div>
  )
}
