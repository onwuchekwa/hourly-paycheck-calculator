/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionKey,
  hasProfileVault,
  saveProfileVault,
  unlockVaultByEmail,
  unlockVaultWithPassword,
} from '../src/lib/offline/encryptedVault'
import {
  fromUserProfile,
  isProfileCacheExpired,
  isUserActive,
  normalizeVaultProfile,
  toUserProfile,
  validateOfflineProfile,
} from '../src/lib/offline/profileValidator'
import type { UserProfile } from '../src/lib/types'

const employeeProfile: UserProfile = {
  uid: 'emp1',
  email: 'employee@test.com',
  displayName: 'Jane Employee',
  role: 'employee',
  currentHourlyRate: 22.5,
  createdBy: 'admin1',
  active: true,
}

describe('profileValidator', () => {
  it('normalizes legacy full UserProfile vault blobs to OfflineProfile', () => {
    const legacy = {
      uid: 'emp1',
      email: 'employee@test.com',
      displayName: 'Jane Employee',
      role: 'employee',
      currentHourlyRate: 22.5,
      createdBy: 'admin1',
      active: true,
    }
    const normalized = normalizeVaultProfile(legacy)
    expect(normalized).toEqual({
      uid: 'emp1',
      email: 'employee@test.com',
      displayName: 'Jane Employee',
      role: 'employee',
      cachedAt: expect.any(String),
    })
    expect(normalized).not.toHaveProperty('currentHourlyRate')
  })

  it('rejects non-employee roles in vault normalization', () => {
    expect(normalizeVaultProfile({ uid: 'a', email: 'a@t.com', displayName: 'Admin', role: 'admin' })).toBeNull()
  })

  it('detects expired offline cache', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(isProfileCacheExpired(old)).toBe(true)
    expect(isProfileCacheExpired(new Date().toISOString())).toBe(false)
  })

  it('validates active users', () => {
    expect(isUserActive({ active: true })).toBe(true)
    expect(isUserActive({})).toBe(true)
    expect(isUserActive({ active: false })).toBe(false)
  })

  it('rejects expired offline profiles for unlock', () => {
    const expired = fromUserProfile(employeeProfile)
    expired.cachedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(validateOfflineProfile(expired)).toEqual({ valid: false, reason: 'offline_cache_expired' })
  })

  it('converts between OfflineProfile and UserProfile', () => {
    const offline = fromUserProfile(employeeProfile, 12345)
    const user = toUserProfile(offline)
    expect(user.role).toBe('employee')
    expect(user.displayName).toBe('Jane Employee')
    expect(user).not.toHaveProperty('currentHourlyRate')
  })
})

describe('offline vault auth', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearSessionKey()
  })

  it('stores only minimal profile fields in encrypted vault', async () => {
    await saveProfileVault('emp1', 'secret-pass', employeeProfile, 999)
    expect(hasProfileVault('emp1')).toBe(true)

    const unlocked = await unlockVaultWithPassword('emp1', 'secret-pass')
    expect(unlocked).not.toBeNull()
    expect(unlocked!.profile).toEqual({
      uid: 'emp1',
      email: 'employee@test.com',
      displayName: 'Jane Employee',
      role: 'employee',
      cachedAt: expect.any(String),
      sourceRev: 999,
    })
    expect(unlocked!.profile).not.toHaveProperty('currentHourlyRate')
    expect(unlocked!.profile).not.toHaveProperty('createdBy')
  })

  it('unlocks vault by email for offline sign-in', async () => {
    await saveProfileVault('emp1', 'secret-pass', employeeProfile)
    clearSessionKey()

    const result = await unlockVaultByEmail('employee@test.com', 'secret-pass')
    expect(result).not.toBeNull()
    expect(result!.employeeId).toBe('emp1')
    expect(toUserProfile(result!.payload.profile).displayName).toBe('Jane Employee')
  })

  it('requires password to unlock after session key is cleared', async () => {
    await saveProfileVault('emp1', 'secret-pass', employeeProfile)
    clearSessionKey()

    const wrong = await unlockVaultWithPassword('emp1', 'wrong-pass')
    expect(wrong).toBeNull()

    const right = await unlockVaultWithPassword('emp1', 'secret-pass')
    expect(right).not.toBeNull()
  })

  it('reports vault exists but locked when session key is cleared', async () => {
    await saveProfileVault('emp1', 'secret-pass', employeeProfile)
    clearSessionKey()

    expect(hasProfileVault('emp1')).toBe(true)
    expect(sessionStorage.getItem('payroll:sessionKey')).toBeNull()
  })
})
