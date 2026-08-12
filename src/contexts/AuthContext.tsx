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
} from '../lib/offline/encryptedVault'
import { isEmployeeRole } from '../lib/offline/types'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isOfflineSession: boolean
  vaultLocked: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineSession, setIsOfflineSession] = useState(false)

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (!snap.exists()) return null
      return { uid, ...snap.data() } as UserProfile
    } catch {
      const vault = await loadProfileFromVault(uid)
      return vault?.profile ?? null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const p = await fetchProfile(user.uid)
    setProfile(p)
  }, [user, fetchProfile])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setIsOfflineSession(false)
      if (u) {
        const p = await fetchProfile(u.uid)
        setProfile(p)
        if (p && isEmployeeRole(p.role) && isVaultUnlocked()) {
          touchLastActiveAt()
        }
      } else if (isVaultUnlocked()) {
        const employeeId = sessionStorage.getItem('payroll:sessionEmployeeId')
        if (employeeId) {
          const vault = await loadProfileFromVault(employeeId)
          if (vault) {
            setProfile(vault.profile)
            setIsOfflineSession(true)
          } else {
            setProfile(null)
          }
        } else {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [fetchProfile])

  const login = useCallback(async (email: string, password: string) => {
    const online = navigator.onLine

    if (!online) {
      if (isAdminRoleOfflineAttempt(email)) {
        throw new Error('Admin sign-in requires an internet connection.')
      }
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
      setProfile(unlocked.payload.profile)
      setIsOfflineSession(true)
      setUser(null)
      return
    }

    await signInWithEmailAndPassword(auth, email, password)
    const current = auth.currentUser
    if (!current) return

    const snap = await getDoc(doc(db, 'users', current.uid))
    if (!snap.exists()) return
    const p = { uid: current.uid, ...snap.data() } as UserProfile

    if (isEmployeeRole(p.role)) {
      await saveProfileVault(current.uid, password, p)
    }
    setIsOfflineSession(false)
  }, [])

  const logout = useCallback(async () => {
    clearSessionKey()
    setIsOfflineSession(false)
    setProfile(null)
    await signOut(auth).catch(() => {})
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
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
  }, [profile, refreshProfile])

  const vaultLocked = useMemo(() => {
    if (!profile || !isEmployeeRole(profile.role)) return false
    return !isVaultUnlocked() && hasProfileVault(profile.uid)
  }, [profile])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isOfflineSession,
      vaultLocked,
      login,
      logout,
      changePassword,
      refreshProfile,
    }),
    [user, profile, loading, isOfflineSession, vaultLocked, login, logout, changePassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function isAdminRoleOfflineAttempt(_email: string): boolean {
  return false
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
