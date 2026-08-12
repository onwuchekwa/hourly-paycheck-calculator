import type { UserProfile } from '../types'
import type { OfflineProfile } from './types'

export const MAX_OFFLINE_DAYS = 7

export function isUserActive(profile: Pick<UserProfile, 'active'>): boolean {
  return profile.active !== false
}

export function isProfileCacheExpired(cachedAt: string): boolean {
  const ageMs = Date.now() - Date.parse(cachedAt)
  return ageMs > MAX_OFFLINE_DAYS * 24 * 60 * 60 * 1000
}

export function toUserProfile(offline: OfflineProfile): UserProfile {
  return {
    uid: offline.uid,
    email: offline.email,
    displayName: offline.displayName,
    role: 'employee',
  }
}

export function fromUserProfile(profile: UserProfile, sourceRev?: number): OfflineProfile {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    role: 'employee',
    cachedAt: new Date().toISOString(),
    sourceRev,
  }
}

/** Accept legacy full UserProfile blobs stored before vault v2. */
export function normalizeVaultProfile(raw: unknown): OfflineProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (p.role !== 'employee') return null
  if (typeof p.uid !== 'string' || typeof p.email !== 'string' || typeof p.displayName !== 'string') {
    return null
  }
  return {
    uid: p.uid,
    email: p.email,
    displayName: p.displayName,
    role: 'employee',
    cachedAt: typeof p.cachedAt === 'string' ? p.cachedAt : new Date().toISOString(),
    sourceRev: typeof p.sourceRev === 'number' ? p.sourceRev : undefined,
  }
}

export function validateOfflineProfile(offline: OfflineProfile): { valid: boolean; reason?: string } {
  if (isProfileCacheExpired(offline.cachedAt)) {
    return { valid: false, reason: 'offline_cache_expired' }
  }
  return { valid: true }
}
