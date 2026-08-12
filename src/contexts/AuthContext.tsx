import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../lib/types'
import { isAdminRole } from '../lib/roles'
import {
  clearSessionKey,
  hasProfileVault,
  isVaultUnlocked,
  loadProfileFromVault,
  saveProfileVault,
  touchLastActiveAt,
  unlockVaultByEmail,
  updateProfileVaultFromSession,
} from '../lib/offline/encryptedVault'
import {
  isProfileCacheExpired,
  isUserActive,
  toUserProfile,
  validateOfflineProfile,
} from '../lib/offline/profileValidator'
import { isEmployeeRole } from '../lib/offline/types'
import { clearPendingData } from '../lib/offline/localStore'

const LOGOUT_MESSAGE_KEY = 'payroll:logoutMessage'

interface FetchProfileResult {
  profile: UserProfile | null
  needsVaultUnlock: boolean
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isOfflineSession: boolean
  vaultLocked: boolean
  needsVaultUnlock: boolean
  logoutMessage: string | null
  clearLogoutMessage: () => void
  login: (email: string, password: string) => Promise<void>
  logout: (message?: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfileForUid(uid: string): Promise<FetchProfileResult> {
  const vaultExists = hasProfileVault(uid)

  const loadUnlockedVault = async (): Promise<UserProfile | null> => {
    if (!isVaultUnlocked()) return null
    const vault = await loadProfileFromVault(uid)
    if (!vault) return null
    const validation = validateOfflineProfile(vault.profile)
    if (!validation.valid) return null
    return toUserProfile(vault.profile)
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      return { profile: { uid, ...snap.data() } as UserProfile, needsVaultUnlock: false }
    }
    if (vaultExists && isVaultUnlocked()) {
      const cached = await loadUnlockedVault()
      if (cached) return { profile: cached, needsVaultUnlock: false }
    }
    if (vaultExists && !isVaultUnlocked()) {
      return { profile: null, needsVaultUnlock: true }
    }
    return { profile: null, needsVaultUnlock: false }
  } catch {
    const cached = await loadUnlockedVault()
    if (cached) return { profile: cached, needsVaultUnlock: false }
    if (vaultExists && !isVaultUnlocked()) {
      return { profile: null, needsVaultUnlock: true }
    }
    return { profile: null, needsVaultUnlock: false }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineSession, setIsOfflineSession] = useState(false)
  const [needsVaultUnlock, setNeedsVaultUnlock] = useState(false)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(() =>
    sessionStorage.getItem(LOGOUT_MESSAGE_KEY),
  )

  const clearLogoutMessage = useCallback(() => {
    sessionStorage.removeItem(LOGOUT_MESSAGE_KEY)
    setLogoutMessage(null)
  }, [])

  const applyFetchResult = useCallback((result: FetchProfileResult) => {
    setProfile(result.profile)
    setNeedsVaultUnlock(result.needsVaultUnlock)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const result = await fetchProfileForUid(user.uid)
    applyFetchResult(result)
  }, [user, applyFetchResult])

  const logout = useCallback(async (message?: string) => {
    clearSessionKey()
    setIsOfflineSession(false)
    setProfile(null)
    setNeedsVaultUnlock(false)
    if (message) {
      sessionStorage.setItem(LOGOUT_MESSAGE_KEY, message)
      setLogoutMessage(message)
    }
    await signOut(auth).catch(() => {})
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setIsOfflineSession(false)

      if (u) {
        const result = await fetchProfileForUid(u.uid)
        applyFetchResult(result)
        if (result.profile && isEmployeeRole(result.profile.role) && isVaultUnlocked()) {
          touchLastActiveAt()
        }
      } else if (isVaultUnlocked()) {
        const employeeId = sessionStorage.getItem('payroll:sessionEmployeeId')
        if (employeeId) {
          const vault = await loadProfileFromVault(employeeId)
          if (vault) {
            const validation = validateOfflineProfile(vault.profile)
            if (validation.valid) {
              setProfile(toUserProfile(vault.profile))
              setIsOfflineSession(true)
              setNeedsVaultUnlock(false)
            } else {
              setProfile(null)
              setNeedsVaultUnlock(true)
            }
          } else {
            setProfile(null)
            setNeedsVaultUnlock(hasProfileVault(employeeId))
          }
        } else {
          setProfile(null)
          setNeedsVaultUnlock(false)
        }
      } else {
        setProfile(null)
        setNeedsVaultUnlock(false)
      }
      setLoading(false)
    })
    return unsub
  }, [applyFetchResult])

  useEffect(() => {
    if (!user || !navigator.onLine) return

    const revalidate = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (!snap.exists()) {
          await logout('Your account profile is missing. Contact your employer.')
          return
        }

        const serverProfile = { uid: user.uid, ...snap.data() } as UserProfile

        if (!isUserActive(serverProfile)) {
          if (isEmployeeRole(serverProfile.role)) {
            await clearPendingData(user.uid)
          }
          await logout('Your account has been deactivated. Contact your employer.')
          return
        }

        if (profile && isEmployeeRole(profile.role) && !isEmployeeRole(serverProfile.role)) {
          await logout('Your account role has changed. Sign in again.')
          return
        }

        if (isEmployeeRole(serverProfile.role) && hasProfileVault(user.uid) && isVaultUnlocked()) {
          const vault = await loadProfileFromVault(user.uid)
          if (vault && isProfileCacheExpired(vault.profile.cachedAt)) {
            clearSessionKey()
            setProfile(serverProfile)
            setNeedsVaultUnlock(true)
            setIsOfflineSession(false)
            sessionStorage.setItem(
              LOGOUT_MESSAGE_KEY,
              'Your offline session expired. Sign in online to refresh offline access.',
            )
            setLogoutMessage(
              'Your offline session expired. Sign in online to refresh offline access.',
            )
            return
          }
          const updatedAt = snap.data()?.updatedAt
          const sourceRev =
            updatedAt && typeof updatedAt.toMillis === 'function' ? updatedAt.toMillis() : undefined
          await updateProfileVaultFromSession(user.uid, serverProfile, sourceRev)
        }

        setProfile(serverProfile)
        setNeedsVaultUnlock(false)
        setIsOfflineSession(false)
      } catch {
        // Keep cached profile when Firestore is unreachable
      }
    }

    const onOnline = () => void revalidate()
    window.addEventListener('online', onOnline)
    void revalidate()
    return () => window.removeEventListener('online', onOnline)
  }, [user, profile, logout])

  const login = useCallback(
    async (email: string, password: string) => {
      const online = navigator.onLine

      if (!online) {
        const unlocked = await unlockVaultByEmail(email, password)
        if (!unlocked) {
          throw new Error(
            'Offline sign-in unavailable. Connect to the internet or use an account that has signed in on this device before.',
          )
        }
        if (isAdminRole(unlocked.payload.profile.role)) {
          clearSessionKey()
          throw new Error('Admin sign-in requires an internet connection.')
        }
        const validation = validateOfflineProfile(unlocked.payload.profile)
        if (!validation.valid) {
          clearSessionKey()
          throw new Error(
            'Your offline session has expired. Connect to the internet and sign in to refresh offline access.',
          )
        }
        setProfile(toUserProfile(unlocked.payload.profile))
        setIsOfflineSession(true)
        setNeedsVaultUnlock(false)
        setUser(null)
        clearLogoutMessage()
        return
      }

      await signInWithEmailAndPassword(auth, email, password)
      const current = auth.currentUser
      if (!current) return

      const snap = await getDoc(doc(db, 'users', current.uid))
      if (!snap.exists()) return
      const p = { uid: current.uid, ...snap.data() } as UserProfile

      if (!isUserActive(p)) {
        await signOut(auth)
        throw new Error('Your account has been deactivated. Contact your employer.')
      }

      if (isEmployeeRole(p.role)) {
        const updatedAt = snap.data()?.updatedAt
        const sourceRev =
          updatedAt && typeof updatedAt.toMillis === 'function' ? updatedAt.toMillis() : undefined
        await saveProfileVault(current.uid, password, p, sourceRev)
      }
      setProfile(p)
      setNeedsVaultUnlock(false)
      setIsOfflineSession(false)
      clearLogoutMessage()
    },
    [clearLogoutMessage],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const currentUser = auth.currentUser
      if (!currentUser?.email) throw new Error('Not authenticated')
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
      if (profile?.mustChangePassword) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          mustChangePassword: false,
          updatedAt: serverTimestamp(),
        })
      }
      if (profile && isEmployeeRole(profile.role)) {
        await saveProfileVault(currentUser.uid, newPassword, profile)
      }
      await refreshProfile()
    },
    [profile, refreshProfile],
  )

  const vaultLocked = useMemo(() => {
    if (needsVaultUnlock) return true
    if (!profile || !isEmployeeRole(profile.role)) return false
    return !isVaultUnlocked() && hasProfileVault(profile.uid)
  }, [profile, needsVaultUnlock])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isOfflineSession,
      vaultLocked,
      needsVaultUnlock,
      logoutMessage,
      clearLogoutMessage,
      login,
      logout,
      changePassword,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      isOfflineSession,
      vaultLocked,
      needsVaultUnlock,
      logoutMessage,
      clearLogoutMessage,
      login,
      logout,
      changePassword,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
