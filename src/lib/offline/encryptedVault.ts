import { argon2id } from '@noble/hashes/argon2.js'
import type { UserProfile } from '../types'
import { fromUserProfile, normalizeVaultProfile } from './profileValidator'
import type { UnlockAttempts, VaultProfilePayload } from './types'
import { LOCKOUT_MS, MAX_UNLOCK_ATTEMPTS, VAULT_VERSION } from './types'

const SESSION_KEY = 'payroll:sessionKey'
const SESSION_EMPLOYEE = 'payroll:sessionEmployeeId'
const DEVICE_ID = 'payroll:deviceId'
const LAST_ACTIVE = 'payroll:lastActiveAt'
const SALT_PREFIX = 'payroll:vault:salt:'
const PROFILE_PREFIX = 'payroll:vault:profile:'
const UNLOCK_ATTEMPTS = 'payroll:unlockAttempts'
const LAST_OFFLINE_EMAIL = 'payroll:lastOfflineEmail'

const ARGON2_OPTS = { t: 3, m: 16384, p: 1, dkLen: 32 } // 16 MB memory for browser practicality

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID, id)
  }
  return id
}

export function getLastActiveAt(): number | null {
  const raw = localStorage.getItem(LAST_ACTIVE)
  return raw ? Date.parse(raw) : null
}

export function touchLastActiveAt(): void {
  localStorage.setItem(LAST_ACTIVE, new Date().toISOString())
}

export function isSessionExpired(): boolean {
  const last = getLastActiveAt()
  if (!last) return false
  return Date.now() - last > 30 * 60 * 1000
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password)
  const hash = argon2id(passwordBytes, salt, ARGON2_OPTS)
  return crypto.subtle.importKey('raw', hash.buffer as ArrayBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export async function deriveHmacKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password)
  const hash = argon2id(passwordBytes, salt, { ...ARGON2_OPTS, dkLen: 32 })
  return crypto.subtle.importKey('raw', hash.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function getOrCreateSalt(employeeId: string): Uint8Array {
  const key = SALT_PREFIX + employeeId
  const existing = localStorage.getItem(key)
  if (existing) return base64ToBytes(existing)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(key, bytesToBase64(salt))
  return salt
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return bytesToBase64(combined)
}

export async function decryptJson<T>(key: CryptoKey, blob: string): Promise<T> {
  const combined = base64ToBytes(blob)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

export async function setSessionKey(key: CryptoKey, employeeId: string): Promise<void> {
  const raw = await crypto.subtle.exportKey('raw', key)
  sessionStorage.setItem(SESSION_KEY, bytesToBase64(new Uint8Array(raw)))
  sessionStorage.setItem(SESSION_EMPLOYEE, employeeId)
}

export async function getSessionKey(): Promise<CryptoKey | null> {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const bytes = base64ToBytes(raw)
  return crypto.subtle.importKey('raw', bytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export function getSessionEmployeeId(): string | null {
  return sessionStorage.getItem(SESSION_EMPLOYEE)
}

export function isVaultUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) !== null
}

export function clearSessionKey(): void {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_EMPLOYEE)
}

function devicePepper(): Uint8Array {
  return new TextEncoder().encode(getDeviceId())
}

async function devicePepperKey(usages: KeyUsage[]): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', devicePepper().buffer as ArrayBuffer)
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, usages)
}

async function encryptUnlockAttempts(data: UnlockAttempts): Promise<string> {
  const pepperKey = await devicePepperKey(['encrypt'])
  return encryptJson(pepperKey as CryptoKey, data)
}

async function decryptUnlockAttempts(blob: string): Promise<UnlockAttempts> {
  const pepperKey = await devicePepperKey(['decrypt'])
  return decryptJson<UnlockAttempts>(pepperKey as CryptoKey, blob)
}

export async function getUnlockAttempts(): Promise<UnlockAttempts> {
  const raw = localStorage.getItem(UNLOCK_ATTEMPTS)
  if (!raw) return { count: 0, lockedUntil: null }
  try {
    return await decryptUnlockAttempts(raw)
  } catch {
    return { count: 0, lockedUntil: null }
  }
}

async function saveUnlockAttempts(data: UnlockAttempts): Promise<void> {
  localStorage.setItem(UNLOCK_ATTEMPTS, await encryptUnlockAttempts(data))
}

export async function isUnlockLockedOut(): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const attempts = await getUnlockAttempts()
  if (!attempts.lockedUntil) return { locked: false, lockedUntil: null }
  const until = new Date(attempts.lockedUntil)
  if (Date.now() >= until.getTime()) {
    await saveUnlockAttempts({ count: 0, lockedUntil: null })
    return { locked: false, lockedUntil: null }
  }
  return { locked: true, lockedUntil: until }
}

export async function recordUnlockFailure(): Promise<void> {
  const attempts = await getUnlockAttempts()
  const count = attempts.count + 1
  if (count >= MAX_UNLOCK_ATTEMPTS) {
    await saveUnlockAttempts({
      count,
      lockedUntil: new Date(Date.now() + LOCKOUT_MS).toISOString(),
    })
  } else {
    await saveUnlockAttempts({ count, lockedUntil: null })
  }
}

export async function resetUnlockAttempts(): Promise<void> {
  await saveUnlockAttempts({ count: 0, lockedUntil: null })
}

export async function unlockVaultWithPassword(
  employeeId: string,
  password: string,
): Promise<VaultProfilePayload | null> {
  const lockout = await isUnlockLockedOut()
  if (lockout.locked) {
    throw new Error(`Too many failed attempts. Try again after ${lockout.lockedUntil?.toLocaleTimeString()}.`)
  }

  const salt = getOrCreateSalt(employeeId)
  const key = await deriveKey(password, salt)
  const blob = localStorage.getItem(PROFILE_PREFIX + employeeId)
  if (!blob) return null

  try {
    const raw = await decryptJson<VaultProfilePayload>(key, blob)
    const profile = normalizeVaultProfile(raw.profile)
    if (!profile) return null
    return { ...raw, profile, vaultVersion: raw.vaultVersion ?? VAULT_VERSION }
  } catch {
    await recordUnlockFailure()
    return null
  }
}

export async function saveProfileVault(
  employeeId: string,
  password: string,
  profile: UserProfile,
  sourceRev?: number,
): Promise<void> {
  const salt = getOrCreateSalt(employeeId)
  const key = await deriveKey(password, salt)
  const payload: VaultProfilePayload = {
    profile: fromUserProfile(profile, sourceRev),
    deviceId: getDeviceId(),
    vaultVersion: VAULT_VERSION,
  }
  localStorage.setItem(PROFILE_PREFIX + employeeId, await encryptJson(key, payload))
  await setSessionKey(key, employeeId)
  await resetUnlockAttempts()
  touchLastActiveAt()
}

export async function updateProfileVaultFromSession(
  employeeId: string,
  profile: UserProfile,
  sourceRev?: number,
): Promise<void> {
  const key = await getSessionKey()
  if (!key || getSessionEmployeeId() !== employeeId) return
  const payload: VaultProfilePayload = {
    profile: fromUserProfile(profile, sourceRev),
    deviceId: getDeviceId(),
    vaultVersion: VAULT_VERSION,
  }
  localStorage.setItem(PROFILE_PREFIX + employeeId, await encryptJson(key, payload))
  touchLastActiveAt()
}

export async function loadProfileFromVault(employeeId: string): Promise<VaultProfilePayload | null> {
  const key = await getSessionKey()
  if (!key || getSessionEmployeeId() !== employeeId) return null
  const blob = localStorage.getItem(PROFILE_PREFIX + employeeId)
  if (!blob) return null
  try {
    const raw = await decryptJson<VaultProfilePayload>(key, blob)
    const profile = normalizeVaultProfile(raw.profile)
    if (!profile) return null
    return { ...raw, profile, vaultVersion: raw.vaultVersion ?? VAULT_VERSION }
  } catch {
    return null
  }
}

export function hasProfileVault(employeeId: string): boolean {
  return localStorage.getItem(PROFILE_PREFIX + employeeId) !== null
}

export function listProfileVaultIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PROFILE_PREFIX)) {
      ids.push(key.slice(PROFILE_PREFIX.length))
    }
  }
  return ids
}

export function hasAnyProfileVault(): boolean {
  return listProfileVaultIds().length > 0
}

export function getLastOfflineEmail(): string | null {
  return localStorage.getItem(LAST_OFFLINE_EMAIL)
}

export function setLastOfflineEmail(email: string): void {
  localStorage.setItem(LAST_OFFLINE_EMAIL, email.trim().toLowerCase())
}

export async function findEmployeeIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PROFILE_PREFIX)) continue
    const employeeId = key.slice(PROFILE_PREFIX.length)
    const payload = await loadProfileFromVault(employeeId)
    if (payload?.profile.email?.toLowerCase() === normalized) return employeeId
  }
  return null
}

export async function unlockVaultByEmail(
  email: string,
  password: string,
): Promise<{ employeeId: string; payload: VaultProfilePayload } | null> {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PROFILE_PREFIX)) continue
    const employeeId = key.slice(PROFILE_PREFIX.length)
    const salt = localStorage.getItem(SALT_PREFIX + employeeId)
    if (!salt) continue
    const lockout = await isUnlockLockedOut()
    if (lockout.locked) {
      throw new Error(`Too many failed attempts. Try again after ${lockout.lockedUntil?.toLocaleTimeString()}.`)
    }
    const derivedKey = await deriveKey(password, base64ToBytes(salt))
    const blob = localStorage.getItem(key)
    if (!blob) continue
    try {
      const raw = await decryptJson<VaultProfilePayload>(derivedKey, blob)
      const profile = normalizeVaultProfile(raw.profile)
      if (!profile) continue
      if (profile.email?.toLowerCase() !== email.trim().toLowerCase()) continue
      await setSessionKey(derivedKey, employeeId)
      await resetUnlockAttempts()
      touchLastActiveAt()
      return { employeeId, payload: { ...raw, profile, vaultVersion: raw.vaultVersion ?? VAULT_VERSION } }
    } catch {
      // try next vault
    }
  }
  await recordUnlockFailure()
  return null
}
