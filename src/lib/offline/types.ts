import type { TimeEntry, TimeEntryStatus, PunchSource, UserProfile } from '../types'

export type ConnectivityMode = 'online' | 'degraded' | 'offline'

export interface OfflineSyncMeta {
  deviceId: string
  syncedAt: string
  appVersion: string
  localRevision: number
}

export interface StoredTimeEntry extends TimeEntry {
  syncStatus: 'pending'
  localUpdatedAt: string
  localRevision: number
  integrity: string
}

export interface VaultProfilePayload {
  profile: UserProfile
  deviceId: string
  vaultVersion: number
}

export interface UnlockAttempts {
  count: number
  lockedUntil: string | null
}

export interface TimestampJson {
  seconds: number
  nanoseconds: number
}

export type JsonTimeEntry = Omit<
  TimeEntry,
  'punches' | 'clockIn' | 'clockOut' | 'submittedAt' | 'approvedAt' | 'rejectedAt' | 'updatedAt' | 'editHistory'
> & {
  punches?: Array<{ clockIn: TimestampJson; clockOut?: TimestampJson | null }>
  clockIn?: TimestampJson | null
  clockOut?: TimestampJson | null
  submittedAt?: TimestampJson
  approvedAt?: TimestampJson
  rejectedAt?: TimestampJson
  updatedAt?: TimestampJson
  editHistory?: Array<
    Omit<NonNullable<TimeEntry['editHistory']>[number], 'editedAt'> & { editedAt: TimestampJson }
  >
  offlineSyncMeta?: OfflineSyncMeta
}

export const APP_VERSION = '1.0.0'
export const VAULT_VERSION = 1
export const INACTIVITY_MS = 30 * 60 * 1000
export const MAX_UNLOCK_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

export function isEmployeeRole(role: string | undefined): boolean {
  return role === 'employee'
}

export function isAdminRoleOfflineBlocked(role: string | undefined): boolean {
  return role === 'admin' || role === 'employer'
}

export type { TimeEntryStatus, PunchSource }
