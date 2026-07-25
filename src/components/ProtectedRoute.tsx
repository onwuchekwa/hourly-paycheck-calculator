import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './LoadingSpinner'
import { adminHomePath, isAdminRole } from '../lib/roles'

interface ProtectedRouteProps {
  role?: 'admin' | 'employee'
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner fullPage />

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (role === 'admin' && !isAdminRole(profile.role)) {
    return <Navigate to={adminHomePath(profile.role)} replace />
  }

  if (role === 'employee' && isAdminRole(profile.role)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
