import { useConnectivity } from '../contexts/ConnectivityContext'
import { AlertBanner } from './AlertBanner'
import { hasPendingData } from '../lib/offline/localStore'
import { useAuth } from '../contexts/AuthContext'

export function OfflineBanner() {
  const { mode, syncing, lastSyncResult, isOnline } = useConnectivity()
  const { profile } = useAuth()

  if (mode === 'degraded') {
    return (
      <AlertBanner variant="warning" className="mb-4">
        Connection unstable — working offline. Changes will sync when connection is restored.
      </AlertBanner>
    )
  }

  if (mode === 'offline') {
    return (
      <AlertBanner variant="warning" className="mb-4">
        Offline — changes saved locally and will sync when you reconnect.
      </AlertBanner>
    )
  }

  if (isOnline && syncing) {
    return (
      <AlertBanner variant="info" className="mb-4">
        Syncing your offline changes…
      </AlertBanner>
    )
  }

  if (isOnline && !syncing && !lastSyncResult?.errors.length && !lastSyncResult?.conflicts.length) {
    if (!profile?.uid || !hasPendingData(profile.uid)) return null
  }

  if (lastSyncResult?.errors.length) {
    const message = lastSyncResult.errors[0]
    const needsReauth =
      message.includes('Authentication expired') || message.includes('Sign in online to sync')
    return (
      <AlertBanner variant="error" className="mb-4">
        Sync issue: {message}
        {needsReauth && ' — sign out and sign back in to sync your offline changes.'}
      </AlertBanner>
    )
  }

  if (lastSyncResult?.conflicts.length) {
    return (
      <AlertBanner variant="warning" className="mb-4">
        Some entries could not sync because they were updated on the server. Contact your employer if needed.
      </AlertBanner>
    )
  }

  return null
}
