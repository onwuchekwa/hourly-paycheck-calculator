import { Router } from 'express'
import type { DocumentReference } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { assertAdmin, requireAuth, type AuthedRequest } from '../auth.js'
import { getDb } from '../admin.js'
import { ApiError, mapFirestoreError } from '../errors.js'

export const payrollRouter = Router()

const BATCH_LIMIT = 499

function requireDocId(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.includes('/')) {
    throw ApiError.invalidArgument(`${name} is required.`)
  }
  return value
}

async function commitBatchDeletes(refs: DocumentReference[]): Promise<void> {
  const db = getDb()
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(ref)
    }
    await batch.commit()
  }
}

payrollRouter.post('/rollback', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const body = req.body as { payrollRunId?: unknown; reopenPeriod?: unknown }
    const payrollRunId = requireDocId(body.payrollRunId, 'payrollRunId')
    const reopenPeriod = body.reopenPeriod === true

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
    const entries = (run.entries ?? []) as Array<{ employeeId?: string }>

    // Pay slip doc IDs are deterministic: {runId}_{employeeId}. Deleting by ID
    // avoids a collection query and saves read quota on every rollback.
    let slipRefs: DocumentReference[] = entries
      .filter((e) => typeof e.employeeId === 'string' && e.employeeId.length > 0)
      .map((e) => db.collection('paySlips').doc(`${payrollRunId}_${e.employeeId}`))

    if (slipRefs.length === 0) {
      const slipsSnap = await db
        .collection('paySlips')
        .where('payrollRunId', '==', payrollRunId)
        .get()
      slipRefs = slipsSnap.docs.map((d) => d.ref)
    }

    await commitBatchDeletes(slipRefs)
    await runRef.delete()

    let payPeriodReopened = false
    if (reopenPeriod) {
      await db.collection('payPeriods').doc(payPeriodId).update({
        status: 'open',
        closedAt: FieldValue.delete(),
      })
      payPeriodReopened = true
    }

    res.json({
      success: true,
      payPeriodReopened,
      deletedSlipCount: slipRefs.length,
    })
  } catch (err) {
    if (err instanceof ApiError) {
      next(err)
      return
    }
    next(mapFirestoreError(err))
  }
})
