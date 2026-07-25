import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { randomBytes } from 'crypto'
import {
  appSignInUrl,
  buildPaySlipEmail,
  buildWelcomeEmail,
  smtpPass,
} from './email'
import { deliverMail, queueMail } from './deliverMail'

initializeApp()

const db = getFirestore()
const auth = getAuth()

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

async function getCompanySettings(): Promise<{ companyName: string; email?: string }> {
  const settingsDoc = await db.collection('settings').doc('company').get()
  const data = settingsDoc.data() ?? {}
  return {
    companyName: (data.companyName as string) ?? 'HourlyPay',
    email: data.email as string | undefined,
  }
}

function mapAuthError(err: unknown): never {
  const code = (err as { code?: string })?.code
  if (code === 'auth/email-already-exists') {
    throw new HttpsError('already-exists', 'An account with this email already exists.')
  }
  if (code === 'auth/invalid-email') {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.')
  }
  throw new HttpsError('internal', 'Failed to create employee. Please try again.')
}

export const createEmployee = onCall({ secrets: [smtpPass] }, async (request) => {
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

  const normalizedEmail = email?.trim().toLowerCase()
  if (!displayName?.trim() || !normalizedEmail || typeof hourlyRate !== 'number' || hourlyRate <= 0) {
    throw new HttpsError('invalid-argument', 'displayName, email, and hourlyRate are required.')
  }

  const tempPassword = generateTempPassword()
  const signInUrl = appSignInUrl.value()
  const startDate = effectiveFrom ?? new Date().toISOString().slice(0, 10)
  const company = await getCompanySettings()

  let userRecord
  try {
    userRecord = await auth.createUser({
      email: normalizedEmail,
      password: tempPassword,
      displayName: displayName.trim(),
      emailVerified: false,
    })
  } catch (err) {
    mapAuthError(err)
  }

  try {
    const batch = db.batch()
    const userRef = db.collection('users').doc(userRecord.uid)
    batch.set(userRef, {
      email: normalizedEmail,
      displayName: displayName.trim(),
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
      employeeName: displayName.trim(),
      hourlyRate,
      effectiveFrom: startDate,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    })

    const welcomeMessage = buildWelcomeEmail({
      displayName: displayName.trim(),
      email: normalizedEmail,
      tempPassword,
      signInUrl,
      companyName: company.companyName,
    })

    const mailRef = db.collection('mail').doc()
    batch.set(mailRef, {
      to: normalizedEmail,
      replyTo: company.email,
      template: 'welcome',
      message: welcomeMessage,
      delivery: { state: 'PENDING', attempts: 0 },
      createdAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return { uid: userRecord.uid, email: normalizedEmail, mailId: mailRef.id }
  } catch (err) {
    await auth.deleteUser(userRecord.uid).catch(() => undefined)
    const message = err instanceof Error ? err.message : 'Failed to create employee.'
    throw new HttpsError('internal', message)
  }
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

async function buildPaySlipMail(slipId: string) {
  const slipDoc = await db.collection('paySlips').doc(slipId).get()
  if (!slipDoc.exists) {
    throw new HttpsError('not-found', 'Pay slip not found.')
  }

  const slip = slipDoc.data()!
  const company = await getCompanySettings()
  const signInUrl = appSignInUrl.value()

  const lineRows = (slip.lineItems ?? [])
    .map(
      (l: { workDate: string; hours: number; rate: number; amount: number }) =>
        `<tr>
          <td style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">${l.workDate}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">${l.hours.toFixed(2)}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">$${l.rate.toFixed(2)}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">$${l.amount.toFixed(2)}</td>
        </tr>`,
    )
    .join('')

  const message = buildPaySlipEmail({
    employeeName: slip.employeeName,
    paySlipNumber: slip.paySlipNumber,
    companyName: company.companyName,
    payPeriodStart: slip.payPeriodStart,
    payPeriodEnd: slip.payPeriodEnd,
    totalHours: slip.totalHours,
    grossPay: slip.grossPay,
    signInUrl,
    lineRows,
  })

  return {
    to: slip.employeeEmail as string,
    replyTo: company.email,
    template: 'payslip' as const,
    message,
  }
}

export const emailPaySlip = onCall({ secrets: [smtpPass] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }
  await assertAdmin(request.auth.uid)

  const { paySlipId } = request.data as { paySlipId?: string }
  if (!paySlipId) {
    throw new HttpsError('invalid-argument', 'paySlipId is required.')
  }

  const mailPayload = await buildPaySlipMail(paySlipId)
  if (!mailPayload.to) {
    throw new HttpsError('failed-precondition', 'Employee email is missing on this pay slip.')
  }

  const mailId = await queueMail(mailPayload)
  return { success: true, mailId }
})

export const emailPaySlipsBatch = onCall({ secrets: [smtpPass] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.')
  }
  await assertAdmin(request.auth.uid)

  const { payrollRunId } = request.data as { payrollRunId?: string }
  if (!payrollRunId) {
    throw new HttpsError('invalid-argument', 'payrollRunId is required.')
  }

  const slipsSnap = await db
    .collection('paySlips')
    .where('payrollRunId', '==', payrollRunId)
    .get()

  if (slipsSnap.empty) {
    throw new HttpsError('not-found', 'No pay slips found for this payroll run.')
  }

  const mailIds: string[] = []
  for (const slipDoc of slipsSnap.docs) {
    const mailPayload = await buildPaySlipMail(slipDoc.id)
    if (!mailPayload.to) continue
    const mailId = await queueMail(mailPayload)
    mailIds.push(mailId)
  }

  return { success: true, count: mailIds.length, mailIds }
})

export { deliverMail }
