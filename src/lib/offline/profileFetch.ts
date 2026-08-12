import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile } from '../types'
import {
  hasAnyProfileVault,
  hasProfileVault,
  isVaultUnlocked,
  loadProfileFromVault,
} from './encryptedVault'
import { toUserProfile, validateOfflineProfile } from './profileValidator'

export interface FetchProfileResult {
  profile: UserProfile | null
  needsVaultUnlock: boolean
}

async function loadUnlockedVault(uid: string): Promise<UserProfile | null> {
  if (!isVaultUnlocked()) return null
  const vault = await loadProfileFromVault(uid)
  if (!vault) return null
  const validation = validateOfflineProfile(vault.profile)
  if (!validation.valid) return null
  return toUserProfile(vault.profile)
}

export async function fetchProfileForUid(uid: string): Promise<FetchProfileResult> {
  const vaultExists = hasProfileVault(uid)

  if (!navigator.onLine) {
    if (vaultExists && isVaultUnlocked()) {
      const cached = await loadUnlockedVault(uid)
      if (cached) return { profile: cached, needsVaultUnlock: false }
    }
    if (vaultExists || hasAnyProfileVault()) {
      return { profile: null, needsVaultUnlock: true }
    }
    return { profile: null, needsVaultUnlock: false }
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      return { profile: { uid, ...snap.data() } as UserProfile, needsVaultUnlock: false }
    }
    if (vaultExists && isVaultUnlocked()) {
      const cached = await loadUnlockedVault(uid)
      if (cached) return { profile: cached, needsVaultUnlock: false }
    }
    if (vaultExists && !isVaultUnlocked()) {
      return { profile: null, needsVaultUnlock: true }
    }
    return { profile: null, needsVaultUnlock: false }
  } catch {
    const cached = await loadUnlockedVault(uid)
    if (cached) return { profile: cached, needsVaultUnlock: false }
    if (vaultExists || hasAnyProfileVault()) {
      return { profile: null, needsVaultUnlock: true }
    }
    return { profile: null, needsVaultUnlock: false }
  }
}

export function shouldPromptOfflineEnrollment(profile: UserProfile | null, uid: string): boolean {
  if (!navigator.onLine || !profile) return false
  if (profile.role !== 'employee') return false
  return !hasProfileVault(uid)
}
