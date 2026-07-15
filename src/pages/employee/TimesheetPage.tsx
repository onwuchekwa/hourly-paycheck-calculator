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
  calcHours,
  formatDate,
  formatTime,
  timeEntryDocId,
  timestampToInputValue,
  inputValueToDate,
} from '../../lib/utils'
import { DatePicker } from '../../components/DatePicker'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function TimesheetPage() {
  const { profile, user } = useAuth()
  const [workDate, setWorkDate] = useState(formatDate(new Date()))
  const [entry, setEntry] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [editReason, setEditReason] = useState('')

  const employeeId = profile?.uid ?? ''
  const docId = timeEntryDocId(employeeId, workDate)
  const readOnly = entry ? !['draft', 'submitted'].includes(entry.status) : false

  useEffect(() => {
    if (!employeeId) return
    const load = async () => {
      setLoading(true)
      const snap = await getDoc(doc(db, 'timeEntries', docId))
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as TimeEntry
        setEntry(data)
        setEditIn(timestampToInputValue(data.clockIn))
        setEditOut(timestampToInputValue(data.clockOut))
      } else {
        setEntry(null)
        setEditIn('')
        setEditOut('')
      }
      setShowEdit(false)
      setLoading(false)
    }
    void load()
  }, [employeeId, docId, workDate])

  const ensureEntry = async (): Promise<TimeEntry> => {
    const ref = doc(db, 'timeEntries', docId)
    const snap = await getDoc(ref)
    if (snap.exists()) return { id: snap.id, ...snap.data() } as TimeEntry

    const newEntry: Omit<TimeEntry, 'id'> = {
      employeeId,
      employeeName: profile?.displayName ?? '',
      workDate,
      status: 'draft',
      clockIn: null,
      clockOut: null,
    }
    await setDoc(ref, { ...newEntry, updatedAt: serverTimestamp() })
    return { id: docId, ...newEntry }
  }

  const handleClockIn = async () => {
    setBusy(true)
    setError('')
    try {
      const current = await ensureEntry()
      if (current.clockIn) {
        setError('Already clocked in for this date.')
        return
      }
      await updateDoc(doc(db, 'timeEntries', docId), {
        clockIn: serverTimestamp(),
        punchSource: 'button',
        updatedAt: serverTimestamp(),
      })
      const updated = await getDoc(doc(db, 'timeEntries', docId))
      setEntry({ id: docId, ...updated.data() } as TimeEntry)
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
      if (!entry?.clockIn) {
        setError('Must clock in first.')
        return
      }
      await updateDoc(doc(db, 'timeEntries', docId), {
        clockOut: serverTimestamp(),
        punchSource: 'button',
        updatedAt: serverTimestamp(),
      })
      const updated = await getDoc(doc(db, 'timeEntries', docId))
      setEntry({ id: docId, ...updated.data() } as TimeEntry)
    } catch {
      setError('Failed to clock out.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!entry?.clockIn || !entry?.clockOut) {
      setError('Complete clock in and out before submitting.')
      return
    }
    setBusy(true)
    await updateDoc(doc(db, 'timeEntries', docId), {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const updated = await getDoc(doc(db, 'timeEntries', docId))
    setEntry({ id: docId, ...updated.data() } as TimeEntry)
    setBusy(false)
  }

  const handleManualEdit = async () => {
    if (editReason.trim().length < 10) {
      setError('Edit reason must be at least 10 characters.')
      return
    }
    const inDate = inputValueToDate(editIn)
    const outDate = inputValueToDate(editOut)
    if (!inDate || !outDate || outDate <= inDate) {
      setError('Valid clock in and out times are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await ensureEntry()
      const historyEntry = {
        editedAt: Timestamp.now(),
        editedBy: user!.uid,
        editedByName: profile!.displayName,
        reason: editReason.trim(),
        previousClockIn: entry?.clockIn ? timestampToInputValue(entry.clockIn) : null,
        previousClockOut: entry?.clockOut ? timestampToInputValue(entry.clockOut) : null,
        newClockIn: editIn,
        newClockOut: editOut,
      }
      await updateDoc(doc(db, 'timeEntries', docId), {
        clockIn: Timestamp.fromDate(inDate),
        clockOut: Timestamp.fromDate(outDate),
        punchSource: 'manual_edit',
        editHistory: [...(entry?.editHistory ?? []), historyEntry],
        updatedAt: serverTimestamp(),
      })
      const updated = await getDoc(doc(db, 'timeEntries', docId))
      setEntry({ id: docId, ...updated.data() } as TimeEntry)
      setShowEdit(false)
      setEditReason('')
    } catch {
      setError('Failed to save edit.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const showClockIn = !entry?.clockIn
  const showClockOut = entry?.clockIn && !entry?.clockOut

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

        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Clock In</p>
              <p className="font-semibold text-lg">{formatTime(entry?.clockIn)}</p>
            </div>
            <div>
              <p className="text-slate-500">Clock Out</p>
              <p className="font-semibold text-lg">{formatTime(entry?.clockOut)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Hours</p>
              <p className="font-semibold text-lg">
                {calcHours(entry?.clockIn, entry?.clockOut).toFixed(2)}
              </p>
            </div>
          </div>

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
                  Clock Out
                </button>
              )}
              {entry?.clockIn && entry?.clockOut && entry.status === 'draft' && (
                <button type="button" onClick={handleSubmit} disabled={busy} className="btn-secondary">
                  Submit for Review
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEdit(!showEdit)}
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
            <div>
              <label htmlFor="edit-in" className="label-field">Clock in</label>
              <input
                id="edit-in"
                type="datetime-local"
                className="input-field"
                value={editIn}
                onChange={(e) => setEditIn(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-out" className="label-field">Clock out</label>
              <input
                id="edit-out"
                type="datetime-local"
                className="input-field"
                value={editOut}
                onChange={(e) => setEditOut(e.target.value)}
              />
            </div>
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
