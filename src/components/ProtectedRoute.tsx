import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useConnectivity } from '../contexts/ConnectivityContext'
import { LoadingSpinner } from './LoadingSpinner'
import { AlertBanner } from './AlertBanner'
import { adminHomePath, isAdminRole } from '../lib/roles'

interface ProtectedRouteProps {
  role?: 'admin' | 'employee'
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, profile, loading, isOfflineSession, vaultLocked, needsVaultUnlock } = useAuth()
  const { isOnline } = useConnectivity()

  if (loading) return <LoadingSpinner fullPage />

  const authenticated = (user || isOfflineSession) && profile

  if (!authenticated) {
    const unlockRequired = vaultLocked || needsVaultUnlock
    return <Navigate to="/login" replace state={unlockRequired ? { unlockRequired: true } : undefined} />
  }

  if (vaultLocked && role === 'employee') {
    return <Navigate to="/login" replace state={{ unlockRequired: true }} />
  }

  if (profile!.mustChangePassword && user) {
    return <Navigate to="/change-password" replace />
  }

  if (role === 'admin' && !isAdminRole(profile!.role)) {
    return <Navigate to={adminHomePath(profile!.role)} replace />
  }

  if (role === 'employee' && isAdminRole(profile!.role)) {
    return <Navigate to="/admin" replace />
  }

  if (role === 'admin' && !isOnline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="card max-w-md space-y-4 border border-slate-200 p-6 shadow-md">
          <h1 className="text-xl font-bold text-slate-900">Internet required</h1>
          <AlertBanner variant="warning">
            Admin features require an active internet connection. Reconnect and try again.
          </AlertBanner>
        </div>
      </div>
    )
  }

  return <Outlet />
}
