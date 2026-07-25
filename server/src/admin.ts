import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let app: App | undefined

export function getAdminApp(): App {
  if (!app) {
    if (getApps().length > 0) {
      app = getApps()[0]
    } else {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
      if (raw) {
        app = initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) })
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
