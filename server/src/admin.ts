import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { ApiError } from './errors.js'

let app: App | undefined

export function getFirebaseConfigStatus(): { configured: boolean; valid: boolean } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return { configured: false, valid: false }
  try {
    JSON.parse(raw)
    return { configured: true, valid: true }
  } catch {
    return { configured: true, valid: false }
  }
}

export function getAdminApp(): App {
  if (!app) {
    if (getApps().length > 0) {
      app = getApps()[0]
    } else {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
      if (raw) {
        let parsed: Parameters<typeof cert>[0]
        try {
          parsed = JSON.parse(raw) as Parameters<typeof cert>[0]
        } catch {
          throw ApiError.internal('Firebase service account JSON is invalid.')
        }
        try {
          app = initializeApp({ credential: cert(parsed) })
        } catch {
          throw ApiError.internal('Firebase Admin SDK failed to initialize.')
        }
      } else {
        app = initializeApp()
      }
    }
  }
  return app
}

export function getDb() {
  getAdminApp()
  return getFirestore()
}

export function getAdminAuth() {
  getAdminApp()
  return getAuth()
}
