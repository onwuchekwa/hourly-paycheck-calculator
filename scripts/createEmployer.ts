/**
 * Optional script to create an employer account.
 * Requires Firebase Admin credentials via GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Usage:
 *   npx tsx scripts/createEmployer.ts --email admin@company.com --name "Admin User" --password "securepass123"
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function parseArgs(): { email: string; name: string; password: string } {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const email = get('--email')
  const name = get('--name')
  const password = get('--password')
  if (!email || !name || !password) {
    console.error('Usage: npx tsx scripts/createEmployer.ts --email <email> --name <name> --password <password>')
    process.exit(1)
  }
  return { email, name, password }
}

async function main() {
  const { email, name, password } = parseArgs()

  if (getApps().length === 0) {
    initializeApp()
  }

  const auth = getAuth()
  const db = getFirestore()

  const user = await auth.createUser({ email, password, displayName: name })
  await db.collection('users').doc(user.uid).set({
    email,
    displayName: name,
    role: 'admin',
    mustChangePassword: false,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  })

  await db.collection('settings').doc('company').set({
    companyName: 'My Company',
    address: '',
    phone: '',
    email,
  }, { merge: true })

  await db.collection('settings').doc('payroll').set({
    lastPaySlipNumber: 0,
    paySlipCounterYear: new Date().getFullYear(),
  }, { merge: true })

  console.log(`Employer created: ${user.uid} (${email})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
