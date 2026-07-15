import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './LoadingSpinner'

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

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/employee'} replace />
  }

  return <Outlet />
}
