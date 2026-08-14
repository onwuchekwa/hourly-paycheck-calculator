import {
  decryptJson,
  encryptJson,
  getSessionEmployeeId,
  getSessionKey,
  isVaultUnlocked,
} from './encryptedVault'
import { storedEntryFromJson, storedEntryToJson } from './serialization'
import { verifyEntryIntegrity, withIntegrity } from './integrity'
import type { StoredTimeEntry } from './types'
import type { TimeEntry } from '../types'

const PENDING_PREFIX = 'payroll:vault:pending:'
const SNAPSHOT_PREFIX = 'payroll:vault:snapshot:'

async function readEncrypted<T>(key: string): Promise<T | null> {
  const sessionKey = await getSessionKey()
  if (!sessionKey) return null
  const blob = localStorage.getItem(key)
  if (!blob) return null
  try {
    return await decryptJson<T>(sessionKey, blob)
  } catch {
    return null
  }
}

async function writeEncrypted(key: string, data: unknown): Promise<void> {
  const sessionKey = await getSessionKey()
  if (!sessionKey) throw new Error('Vault is locked')
  localStorage.setItem(key, await encryptJson(sessionKey, data))
}

export async function getPendingEntries(employeeId: string): Promise<StoredTimeEntry[]> {
  const raw = await readEncrypted<Array<ReturnType<typeof storedEntryToJson>>>(PENDING_PREFIX + employeeId)
  if (!raw) return []
  return raw.map(storedEntryFromJson)
}

export async function setPendingEntries(employeeId: string, entries: StoredTimeEntry[]): Promise<void> {
  await writeEncrypted(
    PENDING_PREFIX + employeeId,
    entries.map(storedEntryToJson),
  )
}

export async function clearPendingData(employeeId: string): Promise<void> {
  localStorage.removeItem(PENDING_PREFIX + employeeId)
}

type SnapshotJson = ReturnType<typeof storedEntryToJson>

// Snapshots keep their HMAC so callers can verify them the same way pending
// entries are verified. Entries written by older builds carry no signature and
// surface with an empty `integrity`, which readers must treat as untrusted.
export async function getSnapshotEntries(employeeId: string): Promise<StoredTimeEntry[]> {
  const raw = await readEncrypted<SnapshotJson[]>(SNAPSHOT_PREFIX + employeeId)
  if (!raw) return []
  return raw.map((json) =>
    storedEntryFromJson({
      ...json,
      syncStatus: 'pending',
      localUpdatedAt: json.localUpdatedAt ?? '',
      localRevision: json.localRevision ?? 0,
      integrity: json.integrity ?? '',
    }),
  )
}

export async function setSnapshotEntries(employeeId: string, entries: StoredTimeEntry[]): Promise<void> {
  await writeEncrypted(
    SNAPSHOT_PREFIX + employeeId,
    entries.map(storedEntryToJson),
  )
}

export async function upsertSnapshotEntry(employeeId: string, entry: TimeEntry): Promise<void> {
  if (!isLocalStoreAccessible(employeeId)) return
  const existing = await getSnapshotEntries(employeeId)
  const verified = await Promise.all(
    existing.map(async (e) => ((await verifyEntryIntegrity(e)) ? e : null)),
  )
  const map = new Map<string, TimeEntry>()
  for (const e of verified) {
    if (e) map.set(e.id, e)
  }
  map.set(entry.id, entry)
  const stored = await Promise.all(
    [...map.values()].map((e) =>
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

export function hasPendingData(employeeId: string): boolean {
  return localStorage.getItem(PENDING_PREFIX + employeeId) !== null
}

export function isLocalStoreAccessible(employeeId: string): boolean {
  return isVaultUnlocked() && getSessionEmployeeId() === employeeId
}

export async function mergeSnapshotAndPending(employeeId: string): Promise<StoredTimeEntry[]> {
  const snapshot = await getSnapshotEntries(employeeId)
  const pending = await getPendingEntries(employeeId)
  const map = new Map<string, StoredTimeEntry>()

  // Keep the snapshot's signed fields intact; rewriting them here would
  // invalidate the HMAC that callers verify.
  for (const entry of snapshot) {
    map.set(entry.id, entry)
  }
  for (const entry of pending) {
    map.set(entry.id, entry)
  }
  return [...map.values()]
}
