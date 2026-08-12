import {
  decryptJson,
  encryptJson,
  getSessionEmployeeId,
  getSessionKey,
  isVaultUnlocked,
} from './encryptedVault'
import { storedEntryFromJson, storedEntryToJson, timeEntryFromJson, timeEntryToJson } from './serialization'
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

type SnapshotJson = ReturnType<typeof timeEntryToJson>

export async function getSnapshotEntries(employeeId: string): Promise<TimeEntry[]> {
  const raw = await readEncrypted<SnapshotJson[]>(SNAPSHOT_PREFIX + employeeId)
  if (!raw) return []
  return raw.map(timeEntryFromJson)
}

export async function setSnapshotEntries(employeeId: string, entries: StoredTimeEntry[]): Promise<void> {
  await writeEncrypted(
    SNAPSHOT_PREFIX + employeeId,
    entries.map((e) => timeEntryToJson(e)),
  )
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

  for (const entry of snapshot) {
    map.set(entry.id, {
      ...entry,
      syncStatus: 'pending',
      localUpdatedAt: '',
      localRevision: 0,
      integrity: '',
    })
  }
  for (const entry of pending) {
    map.set(entry.id, entry)
  }
  return [...map.values()]
}
