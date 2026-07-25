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

/** Removes CR/LF and trims; guards against header/log injection from form input. */
function sanitizeLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_HOURLY_RATE = 10000

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
      displayName?: unknown
      email?: unknown
      hourlyRate?: unknown
      effectiveFrom?: unknown
    }

    const normalizedName = typeof displayName === 'string' ? sanitizeLine(displayName) : ''
    const normalizedEmail = typeof email === 'string' ? sanitizeLine(email).toLowerCase() : ''
    if (!normalizedName || !normalizedEmail || typeof hourlyRate !== 'number') {
      throw ApiError.invalidArgument('displayName, email, and hourlyRate are required.')
    }
    if (normalizedName.length > 100) {
      throw ApiError.invalidArgument('Name must be 100 characters or fewer.')
    }
    if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      throw ApiError.invalidArgument('Please enter a valid email address.')
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || hourlyRate > MAX_HOURLY_RATE) {
      throw ApiError.invalidArgument(`Hourly rate must be between 0 and ${MAX_HOURLY_RATE}.`)
    }
    if (effectiveFrom !== undefined && (typeof effectiveFrom !== 'string' || !DATE_PATTERN.test(effectiveFrom))) {
      throw ApiError.invalidArgument('effectiveFrom must be a YYYY-MM-DD date.')
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
        displayName: normalizedName,
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
        displayName: normalizedName,
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
        employeeName: normalizedName,
        hourlyRate,
        effectiveFrom: startDate,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
      })

      await batch.commit()

      const welcomeMessage = buildWelcomeEmail({
        displayName: normalizedName,
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
      // Log the details server-side; never echo internal errors to the client.
      console.error('Employee creation failed:', err)
      throw ApiError.internal('Failed to create employee. Please try again.')
    }
  } catch (err) {
    next(err)
  }
})
