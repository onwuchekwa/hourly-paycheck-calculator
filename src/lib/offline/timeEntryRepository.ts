import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { TimeEntry } from '../types'
import {
  endOfWorkDate,
  findGlobalOpenPunch,
  getOpenPunch,
  getPunches,
  normalizeEntry,
  punchesToFirestore,
  type OpenPunchLocation,
} from '../timeEntries'
import { timeEntryDocId, todayString } from '../utils'
import {
  getConnectivityMode,
  isNetworkError,
  reportConnectivityFailure,
  shouldFallbackToLocal,
} from './connectivityState'
import {
  getPendingEntries,
  isLocalStoreAccessible,
  mergeSnapshotAndPending,
  setPendingEntries,
  setSnapshotEntries,
  upsertSnapshotEntry,
} from './localStore'
import { verifyEntryIntegrity, withIntegrity } from './integrity'
import type { StoredTimeEntry } from './types'

const FIRESTORE_TIMEOUT_MS = 5000

function withFirestoreTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore request timeout')), FIRESTORE_TIMEOUT_MS),
    ),
  ])
}

function reportFailureIfNetwork(err: unknown): void {
  if (isNetworkError(err)) reportConnectivityFailure()
}

function isDraftOrSubmitted(entry: TimeEntry): boolean {
  return entry.status === 'draft' || entry.status === 'submitted'
}

async function toStored(entry: TimeEntry, revision = 1): Promise<StoredTimeEntry> {
  return withIntegrity({
    ...entry,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    localRevision: revision,
  })
}

export async function applyPendingOverlay(
  employeeId: string,
  serverEntries: TimeEntry[],
): Promise<TimeEntry[]> {
  if (!isLocalStoreAccessible(employeeId)) return serverEntries
  const pending = await getPendingEntries(employeeId)
  const map = new Map(serverEntries.map((entry) => [entry.id, normalizeEntry(entry)]))
  for (const entry of pending) {
    if (entry.integrity && !(await verifyEntryIntegrity(entry))) continue
    map.set(entry.id, normalizeEntry(entry))
  }
  return [...map.values()]
}

async function readMergedEntries(employeeId: string): Promise<TimeEntry[]> {
  const merged = await mergeSnapshotAndPending(employeeId)
  const valid: TimeEntry[] = []
  for (const entry of merged) {
    if (entry.integrity && !(await verifyEntryIntegrity(entry))) continue
    const normalized = normalizeEntry(entry)
    if (isDraftOrSubmitted(normalized) || normalized.status === 'rejected') {
      valid.push(normalized)
    }
  }
  return valid
}

async function readMergedHistoryEntries(employeeId: string): Promise<TimeEntry[]> {
  const merged = await mergeSnapshotAndPending(employeeId)
  const valid: TimeEntry[] = []
  for (const entry of merged) {
    if (entry.integrity && !(await verifyEntryIntegrity(entry))) continue
    valid.push(normalizeEntry(entry))
  }
  return valid.sort((a, b) => b.workDate.localeCompare(a.workDate))
}

async function firestoreFetchEmployeeEntries(employeeId: string): Promise<TimeEntry[]> {
  const q = query(
    collection(db, 'timeEntries'),
    where('employeeId', '==', employeeId),
    where('status', 'in', ['draft', 'submitted', 'rejected']),
  )
  const snap = await withFirestoreTimeout(getDocs(q))
  return snap.docs.map((d) => normalizeEntry({ id: d.id, ...d.data() } as TimeEntry))
}

async function firestoreFetchEmployeeHistory(employeeId: string): Promise<TimeEntry[]> {
  const q = query(
    collection(db, 'timeEntries'),
    where('employeeId', '==', employeeId),
    orderBy('workDate', 'desc'),
  )
  const snap = await withFirestoreTimeout(getDocs(q))
  return snap.docs.map((d) => normalizeEntry({ id: d.id, ...d.data() } as TimeEntry))
}

export async function refreshSnapshot(employeeId: string): Promise<void> {
  if (!isLocalStoreAccessible(employeeId)) return
  const entries = await firestoreFetchEmployeeEntries(employeeId)
  const stored = await Promise.all(
    entries.map((e) =>
      withIntegrity({
        ...e,
        syncStatus: 'pending',
        localUpdatedAt: new Date().toISOString(),
        localRevision: 0,
      }),
    ),
  )
  await setSnapshotEntries(employeeId, stored)
}

async function upsertPending(employeeId: string, entry: TimeEntry): Promise<void> {
  const pending = await getPendingEntries(employeeId)
  const idx = pending.findIndex((p) => p.id === entry.id)
  const revision = idx >= 0 ? pending[idx].localRevision + 1 : 1
  const stored = await toStored(entry, revision)
  if (idx >= 0) pending[idx] = stored
  else pending.push(stored)
  await setPendingEntries(employeeId, pending)
}

async function writeOffline(employeeId: string, entry: TimeEntry): Promise<TimeEntry> {
  if (!isLocalStoreAccessible(employeeId)) {
    throw new Error('Vault is locked. Sign in to continue.')
  }
  await upsertPending(employeeId, entry)
  return normalizeEntry(entry)
}

export async function repositoryGetEntry(
  employeeId: string,
  workDate: string,
): Promise<TimeEntry | null> {
  const docId = timeEntryDocId(employeeId, workDate)
  if (getConnectivityMode() === 'online') {
    try {
      const snap = await withFirestoreTimeout(getDoc(doc(db, 'timeEntries', docId)))
      const serverEntries = snap.exists()
        ? [normalizeEntry({ id: snap.id, ...snap.data() } as TimeEntry)]
        : []
      const overlaid = await applyPendingOverlay(employeeId, serverEntries)
      return overlaid.find((e) => e.id === docId) ?? null
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        reportFailureIfNetwork(err)
      } else {
        throw err
      }
    }
  }
  const merged = await readMergedEntries(employeeId)
  return merged.find((e) => e.id === docId) ?? null
}

export async function repositoryFetchEmployeeEntries(employeeId: string): Promise<TimeEntry[]> {
  if (getConnectivityMode() === 'online') {
    try {
      const entries = await firestoreFetchEmployeeEntries(employeeId)
      await refreshSnapshot(employeeId)
      return applyPendingOverlay(employeeId, entries)
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        reportFailureIfNetwork(err)
      } else {
        throw err
      }
    }
  }
  return readMergedEntries(employeeId)
}

export async function repositoryFetchEmployeeHistory(employeeId: string): Promise<TimeEntry[]> {
  if (getConnectivityMode() === 'online') {
    try {
      const entries = await firestoreFetchEmployeeHistory(employeeId)
      const overlaid = await applyPendingOverlay(employeeId, entries)
      return overlaid.sort((a, b) => b.workDate.localeCompare(a.workDate))
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        reportFailureIfNetwork(err)
      } else {
        throw err
      }
    }
  }
  return readMergedHistoryEntries(employeeId)
}

export async function repositoryFindGlobalOpenPunch(employeeId: string): Promise<OpenPunchLocation | null> {
  const entries = await repositoryFetchEmployeeEntries(employeeId)
  return findGlobalOpenPunch(entries)
}

export async function repositoryEnsureEntry(
  employeeId: string,
  employeeName: string,
  workDate: string,
): Promise<TimeEntry> {
  const docId = timeEntryDocId(employeeId, workDate)
  const existing = await repositoryGetEntry(employeeId, workDate)
  if (existing) return existing

  const newEntry: TimeEntry = {
    id: docId,
    employeeId,
    employeeName,
    workDate,
    status: 'draft',
    punches: [],
  }

  if (getConnectivityMode() === 'online') {
    try {
      await setDoc(doc(db, 'timeEntries', docId), {
        employeeId,
        employeeName,
        workDate,
        status: 'draft',
        punches: [],
        updatedAt: serverTimestamp(),
      })
      await upsertSnapshotEntry(employeeId, newEntry)
      return newEntry
    } catch (err) {
      if (!isNetworkError(err)) throw err
      reportConnectivityFailure()
    }
  }
  return writeOffline(employeeId, newEntry)
}

export async function repositoryUpdateEntry(
  employeeId: string,
  entryId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const workDate = entryId.slice(employeeId.length + 1)
  const current = await repositoryGetEntry(employeeId, workDate)
  if (!current) throw new Error('Entry not found')

  const updated = normalizeEntry({ ...current, ...patch, id: entryId } as TimeEntry)
  const firestorePatch: Record<string, unknown> = {
    ...patch,
    punches: punchesToFirestore(getPunches(updated)),
    clockIn: null,
    clockOut: null,
    updatedAt: serverTimestamp(),
  }
  if (patch.status === 'submitted') {
    firestorePatch.submittedAt = serverTimestamp()
  }

  if (getConnectivityMode() === 'online') {
    try {
      await updateDoc(doc(db, 'timeEntries', entryId), firestorePatch)
      await upsertSnapshotEntry(employeeId, updated)
      return
    } catch (err) {
      if (!isNetworkError(err)) throw err
      reportConnectivityFailure()
    }
  }
  await writeOffline(employeeId, updated)
}

export async function repositoryDeleteEntry(employeeId: string, entryId: string): Promise<void> {
  if (getConnectivityMode() === 'online') {
    try {
      await deleteDoc(doc(db, 'timeEntries', entryId))
      await refreshSnapshot(employeeId)
      const pending = await getPendingEntries(employeeId)
      await setPendingEntries(
        employeeId,
        pending.filter((p) => p.id !== entryId),
      )
      return
    } catch (err) {
      if (!isNetworkError(err)) throw err
      reportConnectivityFailure()
    }
  }
  const pending = await getPendingEntries(employeeId)
  await setPendingEntries(
    employeeId,
    pending.filter((p) => p.id !== entryId),
  )
}

export async function repositoryAutoCloseStalePunches(employeeId: string): Promise<void> {
  const today = todayString()
  const entries = await repositoryFetchEmployeeEntries(employeeId)

  for (const entry of entries) {
    if (entry.workDate >= today) continue
    const open = getOpenPunch(entry)
    if (!open) continue

    const punches = [...getPunches(entry)]
    punches[open.index] = {
      ...punches[open.index],
      clockOut: Timestamp.fromDate(endOfWorkDate(entry.workDate)),
    }

    await repositoryUpdateEntry(employeeId, entry.id, {
      punches: punchesToFirestore(punches),
      punchSource: 'auto_eod',
    })
  }
}

export { getPendingEntries }
