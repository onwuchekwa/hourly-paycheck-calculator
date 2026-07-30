import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { assertAdmin, requireAuth, type AuthedRequest } from '../auth.js'
import { getDb } from '../admin.js'
import { ApiError } from '../errors.js'

export const payrollRouter = Router()

function requireDocId(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.includes('/')) {
    throw ApiError.invalidArgument(`${name} is required.`)
  }
  return value
}

payrollRouter.post('/rollback', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const payrollRunId = requireDocId(
      (req.body as { payrollRunId?: unknown }).payrollRunId,
      'payrollRunId',
    )

    const db = getDb()
    const runRef = db.collection('payrollRuns').doc(payrollRunId)
    const runDoc = await runRef.get()

    if (!runDoc.exists) {
      throw ApiError.notFound('Payroll run not found.')
    }

    const run = runDoc.data()!
    if (run.status !== 'finalized') {
      throw ApiError.failedPrecondition('Only finalized payroll runs can be rolled back.')
    }

    const payPeriodId = run.payPeriodId as string
    const slipsSnap = await db.collection('paySlips').where('payrollRunId', '==', payrollRunId).get()

    const batch = db.batch()
    for (const slipDoc of slipsSnap.docs) {
      batch.delete(slipDoc.ref)
    }
    batch.delete(runRef)
    await batch.commit()

    const remainingSnap = await db
      .collection('payrollRuns')
      .where('payPeriodId', '==', payPeriodId)
      .where('status', '==', 'finalized')
      .get()

    let payPeriodReopened = false
    if (remainingSnap.empty) {
      await db.collection('payPeriods').doc(payPeriodId).update({
        status: 'open',
        closedAt: FieldValue.delete(),
      })
      payPeriodReopened = true
    }

    res.json({
      success: true,
      payPeriodReopened,
      deletedSlipCount: slipsSnap.size,
    })
  } catch (err) {
    next(err)
  }
})
