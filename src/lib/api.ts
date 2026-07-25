import { auth } from './firebase'
import { ApiClientError } from './errors'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function isApiConfigured(): boolean {
  return Boolean(API_URL)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) {
    throw new ApiClientError('failed-precondition', 'API URL is not configured. Set VITE_API_URL in .env')
  }

  const user = auth.currentUser
  if (!user) {
    throw new ApiClientError('unauthenticated', 'Please sign in again.')
  }

  const token = await user.getIdToken()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }

  if (!res.ok) {
    throw new ApiClientError(data.error ?? 'internal', data.message ?? 'Request failed.')
  }

  return data as T
}

export { ApiClientError }
