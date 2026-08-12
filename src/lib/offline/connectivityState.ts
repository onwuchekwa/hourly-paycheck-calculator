import type { ConnectivityMode } from './types'

type Listener = (mode: ConnectivityMode) => void

let mode: ConnectivityMode = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
let failureCount = 0
const listeners = new Set<Listener>()

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

export function reportConnectivityFailure(): void {
  failureCount += 1
  if (!navigator.onLine) {
    setConnectivityMode('offline')
  } else if (failureCount >= 2) {
    setConnectivityMode('degraded')
  }
}

export function reportConnectivitySuccess(): void {
  failureCount = 0
  if (navigator.onLine) {
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
    message.includes('NetworkError')
  )
}
