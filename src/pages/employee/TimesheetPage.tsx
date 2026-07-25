import { useEffect, useState } from 'react'
import {
  doc,
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
  canSubmitEntry,
  fetchEmployeeEntries,
  findGlobalOpenPunch,
  formatEntryDuration,
  formatPunchDuration,
  getOpenPunch,
  getPunches,
  normalizeEntry,
  parseEditRows,
  punchesToEditRows,
  punchesToFirestore,
  serializePunchesForHistory,
  type EditPunchRow,
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

export function TimesheetPage() {
  const { profile, user } = useAuth()
  const [workDate, setWorkDate] = useState(formatDate(new Date()))
  const [entry, setEntry] = useState<TimeEntry | null>(null)
  const [globalOpenEntryId, setGlobalOpenEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editRows, setEditRows] = useState<EditPunchRow[]>([{ clockIn: '', clockOut: '' }])
  const [editReason, setEditReason] = useState('')

  const employeeId = profile?.uid ?? ''
  const docId = timeEntryDocId(employeeId, workDate)
  const normalizedEntry = entry ? normalizeEntry(entry) : null
  const punches = getPunches(normalizedEntry)
  const readOnly = entry ? !['draft', 'submitted'].includes(entry.status) : false
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
      setShowEdit(false)
    } catch {
      setError('Unable to load timesheet. Please try again or contact your employer.')
    } finally {
      setLoading(false)
    }
  }

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
        punches: punchesToFirestore([
          ...currentPunches,
          { clockIn: Timestamp.now(), clockOut: null },
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
        clockOut: Timestamp.now(),
      }

      await updateDoc(doc(db, 'timeEntries', open.entryId), {
        punches: punchesToFirestore(punches),
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
    if (!normalizedEntry || !canSubmitEntry(normalizedEntry)) {
      setError('Complete all sessions before submitting.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(db, 'timeEntries', docId), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await loadEntry()
    } catch {
      setError('Failed to submit entry.')
    } finally {
      setBusy(false)
    }
  }

  const openManualEdit = () => {
    setEditRows(punchesToEditRows(normalizedEntry ?? { id: docId, employeeId, employeeName: '', workDate, status: 'draft' }))
    setEditReason('')
    setShowEdit(true)
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

  const handleManualEdit = async () => {
    if (editReason.trim().length < 10) {
      setError('Edit reason must be at least 10 characters.')
      return
    }
    const parsed = parseEditRows(editRows)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError('')
    try {
      await ensureEntry()
      const previousPunches = getPunches(normalizedEntry)
      const historyEntry = {
        editedAt: Timestamp.now(),
        editedBy: user!.uid,
        editedByName: profile!.displayName,
        reason: editReason.trim(),
        previousPunches: serializePunchesForHistory(previousPunches),
        newPunches: serializePunchesForHistory(parsed.punches),
      }
      await updateDoc(doc(db, 'timeEntries', docId), {
        punches: punchesToFirestore(parsed.punches),
        clockIn: null,
        clockOut: null,
        punchSource: 'manual_edit',
        editHistory: [...(entry?.editHistory ?? []), historyEntry],
        updatedAt: serverTimestamp(),
      })
      setShowEdit(false)
      setEditReason('')
      await loadEntry()
    } catch {
      setError('Failed to save edit.')
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
                <div key={index} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{formatTime(punch.clockIn)}</span>
                    <span className="text-slate-400"> – </span>
                    <span className="font-medium">
                      {punch.clockOut ? formatTime(punch.clockOut) : 'Open'}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-800">{formatPunchDuration(punch)}</span>
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
              {normalizedEntry && canSubmitEntry(normalizedEntry) && entry?.status === 'draft' && (
                <button type="button" onClick={handleSubmit} disabled={busy} className="btn-secondary">
                  Submit for Review
                </button>
              )}
              <button
                type="button"
                onClick={() => (showEdit ? setShowEdit(false) : openManualEdit())}
                disabled={busy}
                className="btn-secondary"
              >
                Manual Edit
              </button>
            </div>
          )}
        </div>

        {showEdit && !readOnly && (
          <div className="card space-y-4">
            <h2 className="font-semibold">Manual time edit</h2>
            <p className="text-sm text-slate-600">Edit all sessions for this day.</p>
            {editRows.map((row, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Session {index + 1}</span>
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
                <div>
                  <label htmlFor={`edit-in-${index}`} className="label-field">Clock in</label>
                  <input
                    id={`edit-in-${index}`}
                    type="datetime-local"
                    className="input-field"
                    value={row.clockIn}
                    onChange={(e) => updateEditRow(index, 'clockIn', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={`edit-out-${index}`} className="label-field">Clock out</label>
                  <input
                    id={`edit-out-${index}`}
                    type="datetime-local"
                    className="input-field"
                    value={row.clockOut}
                    onChange={(e) => updateEditRow(index, 'clockOut', e.target.value)}
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={addEditRow} className="btn-secondary text-sm">
              Add session
            </button>
            <div>
              <label htmlFor="edit-reason" className="label-field">
                Reason for edit (min 10 characters)
              </label>
              <textarea
                id="edit-reason"
                className="input-field min-h-20"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <button type="button" onClick={handleManualEdit} disabled={busy} className="btn-primary">
              Save Edit
            </button>
          </div>
        )}

        {readOnly && (
          <p className="text-sm text-slate-600">
            This entry is {entry?.status} and cannot be edited.
          </p>
        )}
      </div>
    </div>
  )
}
