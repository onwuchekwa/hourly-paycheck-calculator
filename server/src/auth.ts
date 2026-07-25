import type { NextFunction, Request, Response } from 'express'
import { getAdminAuth, getDb } from './admin.js'
import { ApiError } from './errors.js'

export interface AuthedRequest extends Request {
  uid: string
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthenticated', message: 'Authentication required.' })
    return
  }

  try {
    const token = header.slice(7)
    const decoded = await getAdminAuth().verifyIdToken(token)
    ;(req as AuthedRequest).uid = decoded.uid
    next()
  } catch {
    res.status(401).json({ error: 'unauthenticated', message: 'Please sign in again.' })
  }
}

export async function assertAdmin(uid: string): Promise<void> {
  const userDoc = await getDb().collection('users').doc(uid).get()
  const role = userDoc.data()?.role
  if (!userDoc.exists || (role !== 'admin' && role !== 'employer')) {
    throw ApiError.permissionDenied()
  }
}

export async function getCompanySettings(): Promise<{ companyName: string; email?: string }> {
  const settingsDoc = await getDb().collection('settings').doc('company').get()
  const data = settingsDoc.data() ?? {}
  return {
    companyName: (data.companyName as string) ?? 'HourlyPay',
    email: data.email as string | undefined,
  }
}
