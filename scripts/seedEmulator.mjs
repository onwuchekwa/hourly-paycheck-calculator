/**
 * Seeds the local Firebase emulators with a test admin account.
 *
 * Prerequisites: emulators running (npm run emulators)
 *
 * Usage: npm run seed:emulator
 */

const PROJECT_ID = 'demo-hourly-paycheck'
const AUTH_HOST = '127.0.0.1:9099'
const FIRESTORE_HOST = '127.0.0.1:8080'

const ADMIN = {
  email: 'admin@local.test',
  password: 'password123',
  displayName: 'Local Admin',
}

function firestoreValue(value: string | boolean | number) {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  return { integerValue: String(value) }
}

async function createAuthUser() {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN.email,
        password: ADMIN.password,
        returnSecureToken: true,
      }),
    },
  )

  const data = (await res.json()) as { localId?: string; error?: { message?: string } }
  if (!res.ok) {
    if (data.error?.message?.includes('EMAIL_EXISTS')) {
      const lookup = await fetch(
        `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: [ADMIN.email] }),
        },
      )
      const lookupData = (await lookup.json()) as { users?: Array<{ localId: string }> }
      const uid = lookupData.users?.[0]?.localId
      if (!uid) throw new Error('Admin user exists but could not be looked up')
      console.log('Admin user already exists, reusing profile.')
      return uid
    }
    throw new Error(data.error?.message ?? 'Failed to create auth user')
  }

  if (!data.localId) throw new Error('Auth emulator did not return a user id')
  return data.localId
}

async function writeDocument(collection: string, docId: string, fields: Record<string, unknown>) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to write ${collection}/${docId}: ${body}`)
  }
}

async function main() {
  const uid = await createAuthUser()

  await writeDocument('users', uid, {
    email: firestoreValue(ADMIN.email),
    displayName: firestoreValue(ADMIN.displayName),
    role: firestoreValue('admin'),
    mustChangePassword: firestoreValue(false),
    status: firestoreValue('active'),
    active: firestoreValue(true),
  })

  await writeDocument('settings', 'company', {
    companyName: firestoreValue('Local Test Company'),
    address: firestoreValue('123 Dev Street'),
    phone: firestoreValue(''),
    email: firestoreValue(ADMIN.email),
  })

  await writeDocument('settings', 'payroll', {
    lastPaySlipNumber: firestoreValue(0),
    paySlipCounterYear: firestoreValue(new Date().getFullYear()),
  })

  console.log(`Seeded admin user: ${ADMIN.email} / ${ADMIN.password}`)
  console.log(`User id: ${uid}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  console.error('Make sure Firebase emulators are running: npm run emulators')
  process.exit(1)
})
