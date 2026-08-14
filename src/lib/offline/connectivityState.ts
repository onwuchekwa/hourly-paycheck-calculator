import type { ConnectivityMode } from './types'

type Listener = (mode: ConnectivityMode) => void
type FailureListener = () => void

const ONLINE_SUCCESS_THRESHOLD = 2

let mode: ConnectivityMode =
  typeof navigator !== 'undefined' && navigator.onLine ? 'degraded' : 'offline'
let failureCount = 0
let successStreak = 0
let suppressFailureReports = false
const listeners = new Set<Listener>()
const failureListeners = new Set<FailureListener>()

export function getConnectivityMode(): ConnectivityMode {
  return mode
}

export function setConnectivityMode(next: ConnectivityMode): void {
  if (mode === next) return
  mode = next
  if (next === 'online') failureCount = 0
  listeners.forEach((fn) => fn(next))
}

export function subscribeConnectivity(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function subscribeConnectivityFailures(fn: FailureListener): () => void {
  failureListeners.add(fn)
  return () => failureListeners.delete(fn)
}

export function setSuppressConnectivityFailures(value: boolean): void {
  suppressFailureReports = value
}

export function reportConnectivityFailure(): void {
  if (suppressFailureReports) return
  successStreak = 0
  failureCount += 1
  const prev = mode
  if (!navigator.onLine) {
    setConnectivityMode('offline')
  } else {
    setConnectivityMode('degraded')
  }
  if (mode !== prev) failureListeners.forEach((fn) => fn())
}

export function reportConnectivitySuccess(): void {
  if (!navigator.onLine) return
  successStreak += 1
  if (mode === 'online') {
    failureCount = 0
    return
  }
  if (successStreak >= ONLINE_SUCCESS_THRESHOLD) {
    failureCount = 0
    setConnectivityMode('online')
  }
}

export function resetConnectivityFailureCount(): void {
  failureCount = 0
}

export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  const message = (err as { message?: string }).message ?? ''
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network-request-failed' ||
    message.includes('network') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('timeout')
  )
}

export function isAuthOrPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === 'permission-denied' || code === 'unauthenticated'
}

export function shouldFallbackToLocal(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return isNetworkError(err) || isAuthOrPermissionError(err) || code === 'resource-exhausted'
}

/** @internal Test helper */
export function resetConnectivityStateForTests(initial?: ConnectivityMode): void {
  mode =
    initial ??
    (typeof navigator !== 'undefined' && navigator.onLine ? 'degraded' : 'offline')
  failureCount = 0
  successStreak = 0
  suppressFailureReports = false
}
