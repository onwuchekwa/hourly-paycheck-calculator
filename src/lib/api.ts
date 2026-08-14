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

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const message =
      err instanceof TypeError && err.message.includes('Failed to fetch')
        ? 'Could not reach the email API. Check your connection and that VITE_API_URL is configured.'
        : err instanceof Error
          ? err.message
          : 'Network request failed.'
    throw new ApiClientError('unavailable', message)
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }

  if (!res.ok) {
    throw new ApiClientError(data.error ?? 'internal', data.message ?? 'Request failed.')
  }

  return data as T
}

export { ApiClientError }
