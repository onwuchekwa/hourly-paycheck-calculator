import { useAuth } from '../contexts/AuthContext'
import { useInactivityTimeout } from '../hooks/useInactivityTimeout'

export function SessionGuard() {
  const { user, profile, isOfflineSession, logout } = useAuth()
  const enabled = Boolean((user || isOfflineSession) && profile)

  useInactivityTimeout(enabled, () => {
    void logout()
  })

  return null
}
