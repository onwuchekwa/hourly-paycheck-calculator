export const DEMO_FIREBASE_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-hourly-paycheck.firebaseapp.com',
  projectId: 'demo-hourly-paycheck',
  storageBucket: 'demo-hourly-paycheck.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:local-dev',
} as const

export type FirebaseClientConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true
  return value.includes('your-') || value === '123456789' || value === 'abcdef'
}

export function useFirebaseEmulators(): boolean {
  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
}

export function resolveFirebaseConfig(): FirebaseClientConfig {
  const fromEnv: FirebaseClientConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  }

  if (useFirebaseEmulators()) {
    return {
      apiKey: isPlaceholder(fromEnv.apiKey) ? DEMO_FIREBASE_CONFIG.apiKey : fromEnv.apiKey,
      authDomain: isPlaceholder(fromEnv.authDomain) ? DEMO_FIREBASE_CONFIG.authDomain : fromEnv.authDomain,
      projectId: isPlaceholder(fromEnv.projectId) ? DEMO_FIREBASE_CONFIG.projectId : fromEnv.projectId,
      storageBucket: isPlaceholder(fromEnv.storageBucket)
        ? DEMO_FIREBASE_CONFIG.storageBucket
        : fromEnv.storageBucket,
      messagingSenderId: isPlaceholder(fromEnv.messagingSenderId)
        ? DEMO_FIREBASE_CONFIG.messagingSenderId
        : fromEnv.messagingSenderId,
      appId: isPlaceholder(fromEnv.appId) ? DEMO_FIREBASE_CONFIG.appId : fromEnv.appId,
    }
  }

  return fromEnv
}

export function isFirebaseReady(): boolean {
  if (useFirebaseEmulators()) return true

  const config = resolveFirebaseConfig()
  return (
    !isPlaceholder(config.apiKey) &&
    !isPlaceholder(config.authDomain) &&
    !isPlaceholder(config.projectId) &&
    !isPlaceholder(config.storageBucket) &&
    !isPlaceholder(config.messagingSenderId) &&
    !isPlaceholder(config.appId)
  )
}
