import { randomBytes } from 'crypto'
import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { assertAdmin, getCompanySettings, requireAuth, type AuthedRequest } from '../auth.js'
import { getAdminAuth, getDb } from '../admin.js'
import { ApiError } from '../errors.js'
import { buildWelcomeEmail, getAppSignInUrl, sendMail } from '../email.js'

export const employeesRouter = Router()

function generateTempPassword(): string {
  return randomBytes(12).toString('base64url').slice(0, 16)
}

function mapAuthError(err: unknown): never {
  const code = (err as { code?: string })?.code
  if (code === 'auth/email-already-exists') {
    throw ApiError.alreadyExists()
  }
  if (code === 'auth/invalid-email') {
    throw ApiError.invalidArgument('Please enter a valid email address.')
  }
  throw ApiError.internal('Failed to create employee. Please try again.')
}

employeesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const { displayName, email, hourlyRate, effectiveFrom } = req.body as {
      displayName?: string
      email?: string
      hourlyRate?: number
      effectiveFrom?: string
    }

    const normalizedEmail = email?.trim().toLowerCase()
    if (!displayName?.trim() || !normalizedEmail || typeof hourlyRate !== 'number' || hourlyRate <= 0) {
      throw ApiError.invalidArgument('displayName, email, and hourlyRate are required.')
    }

    const tempPassword = generateTempPassword()
    const signInUrl = getAppSignInUrl()
    const startDate = effectiveFrom ?? new Date().toISOString().slice(0, 10)
    const company = await getCompanySettings()
    const auth = getAdminAuth()
    const db = getDb()

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
      const userRef = db.collection('users').doc(userRecord!.uid)
      batch.set(userRef, {
        email: normalizedEmail,
        displayName: displayName.trim(),
        role: 'employee',
        mustChangePassword: true,
        currentHourlyRate: hourlyRate,
        status: 'active',
        active: true,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      const rateRef = db.collection('employeeRates').doc()
      batch.set(rateRef, {
        employeeId: userRecord!.uid,
        employeeName: displayName.trim(),
        hourlyRate,
        effectiveFrom: startDate,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
      })

      await batch.commit()

      const welcomeMessage = buildWelcomeEmail({
        displayName: displayName.trim(),
        email: normalizedEmail,
        tempPassword,
        signInUrl,
        companyName: company.companyName,
      })

      let mailWarning: string | undefined
      try {
        await sendMail({
          to: normalizedEmail,
          replyTo: company.email,
          message: welcomeMessage,
        })
      } catch (mailErr) {
        mailWarning =
          mailErr instanceof Error
            ? mailErr.message
            : 'Welcome email could not be sent. Configure SMTP in server/.env.'
      }

      res.json({ uid: userRecord!.uid, email: normalizedEmail, mailWarning })
    } catch (err) {
      await auth.deleteUser(userRecord!.uid).catch(() => undefined)
      if (err instanceof ApiError) throw err
      const message = err instanceof Error ? err.message : 'Failed to create employee.'
      throw ApiError.internal(message)
    }
  } catch (err) {
    next(err)
  }
})
