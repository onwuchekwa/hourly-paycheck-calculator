import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import { randomBytes } from 'crypto'

initializeApp()

const db = getFirestore()
const auth = getAuth()
const appSignInUrl = defineString('APP_SIGN_IN_URL', { default: 'http://localhost:5173/login' })

function generateTempPassword(): string {
  return randomBytes(12).toString('base64url').slice(0, 16)
}

async function assertAdmin(uid: string): Promise<void> {
  const userDoc = await db.collection('users').doc(uid).get()
  const role = userDoc.data()?.role
  if (!userDoc.exists || (role !== 'admin' && role !== 'employer')) {
    throw new HttpsError('permission-denied', 'Only admins can perform this action.')
  }
}

export const createEmployee = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }
  await assertAdmin(request.auth.uid)

  const { displayName, email, hourlyRate, effectiveFrom } = request.data as {
    displayName?: string
    email?: string
    hourlyRate?: number
    effectiveFrom?: string
  }

  if (!displayName || !email || typeof hourlyRate !== 'number' || hourlyRate <= 0) {
    throw new HttpsError('invalid-argument', 'displayName, email, and hourlyRate are required.')
  }

  const tempPassword = generateTempPassword()
  const signInUrl = appSignInUrl.value()
  const startDate = effectiveFrom ?? new Date().toISOString().slice(0, 10)

  const userRecord = await auth.createUser({
    email,
    password: tempPassword,
    displayName,
    emailVerified: false,
  })

  const batch = db.batch()
  const userRef = db.collection('users').doc(userRecord.uid)
  batch.set(userRef, {
    email,
    displayName,
    role: 'employee',
    mustChangePassword: true,
    currentHourlyRate: hourlyRate,
    status: 'active',
    active: true,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const rateRef = db.collection('employeeRates').doc()
  batch.set(rateRef, {
    employeeId: userRecord.uid,
    employeeName: displayName,
    hourlyRate,
    effectiveFrom: startDate,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  })

  const mailRef = db.collection('mail').doc()
  batch.set(mailRef, {
    to: email,
    message: {
      subject: 'Your payroll account is ready',
      html: `
        <p>Hello ${displayName},</p>
        <p>Your employer has created a payroll account for you.</p>
        <p><strong>Username:</strong> ${email}</p>
        <p><strong>Temporary password:</strong> ${tempPassword}</p>
        <p><a href="${signInUrl}">Sign in here</a></p>
        <p>You will be asked to change your password on first sign-in.</p>
      `,
      text: `Hello ${displayName}. Username: ${email}. Temporary password: ${tempPassword}. Sign in: ${signInUrl}. Change your password on first login.`,
    },
  })

  await batch.commit()

  return { uid: userRecord.uid, email }
})

export const clearMustChangePassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }

  await db.collection('users').doc(request.auth.uid).update({
    mustChangePassword: false,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { success: true }
})

export const emailPaySlip = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }
  await assertAdmin(request.auth.uid)

  const { paySlipId } = request.data as { paySlipId?: string }
  if (!paySlipId) {
    throw new HttpsError('invalid-argument', 'paySlipId is required.')
  }

  const slipDoc = await db.collection('paySlips').doc(paySlipId).get()
  if (!slipDoc.exists) {
    throw new HttpsError('not-found', 'Pay slip not found.')
  }

  const slip = slipDoc.data()!
  const settingsDoc = await db.collection('settings').doc('company').get()
  const companyName = settingsDoc.data()?.companyName ?? 'HourlyPay'
  const signInUrl = appSignInUrl.value()

  const lineRows = (slip.lineItems ?? [])
    .map(
      (l: { workDate: string; hours: number; rate: number; amount: number }) =>
        `<tr><td>${l.workDate}</td><td>${l.hours.toFixed(2)}</td><td>$${l.rate.toFixed(2)}</td><td>$${l.amount.toFixed(2)}</td></tr>`,
    )
    .join('')

  await db.collection('mail').add({
    to: slip.employeeEmail,
    message: {
      subject: `Pay Slip ${slip.paySlipNumber} — ${companyName}`,
      html: `
        <h2>Pay Slip ${slip.paySlipNumber}</h2>
        <p><strong>Employee:</strong> ${slip.employeeName}</p>
        <p><strong>Period:</strong> ${slip.payPeriodStart} – ${slip.payPeriodEnd}</p>
        <p><strong>Total Hours:</strong> ${slip.totalHours.toFixed(2)}</p>
        <p><strong>Gross Pay:</strong> $${slip.grossPay.toFixed(2)}</p>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><th>Date</th><th>Hours</th><th>Rate</th><th>Amount</th></tr>
          ${lineRows}
        </table>
        <p><a href="${signInUrl}">Sign in to HourlyPay</a> to view and print your full pay slip.</p>
      `,
      text: `Pay Slip ${slip.paySlipNumber} for ${slip.employeeName}. Period: ${slip.payPeriodStart} – ${slip.payPeriodEnd}. Gross: $${slip.grossPay.toFixed(2)}. Sign in: ${signInUrl}`,
    },
  })

  return { success: true }
})
