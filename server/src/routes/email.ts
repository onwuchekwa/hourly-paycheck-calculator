import { Router } from 'express'
import { assertAdmin, getCompanySettings, requireAuth, type AuthedRequest } from '../auth.js'
import { getDb } from '../admin.js'
import { ApiError } from '../errors.js'
import { buildPaySlipEmail, escapeHtml, getAppSignInUrl, sendMail } from '../email.js'

export const emailRouter = Router()

const MAX_BATCH_SLIPS = 500

function requireDocId(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.includes('/')) {
    throw ApiError.invalidArgument(`${name} is required.`)
  }
  return value
}

function toMoney(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

async function buildPaySlipMail(slipId: string) {
  const slipDoc = await getDb().collection('paySlips').doc(slipId).get()
  if (!slipDoc.exists) {
    throw ApiError.notFound('Pay slip not found.')
  }

  const slip = slipDoc.data()!
  const company = await getCompanySettings()
  const signInUrl = getAppSignInUrl()

  const lineRows = (slip.lineItems ?? [])
    .map(
      (l: { workDate?: unknown; hours?: unknown; rate?: unknown; amount?: unknown }) =>
        `<tr>
          <td style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">${escapeHtml(String(l.workDate ?? ''))}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">${toMoney(l.hours)}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">$${toMoney(l.rate)}</td>
          <td align="right" style="padding:8px;border-top:1px solid #e2e8f0;color:#334155;">$${toMoney(l.amount)}</td>
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
    message,
  }
}

emailRouter.post('/payslip', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const paySlipId = requireDocId((req.body as { paySlipId?: unknown }).paySlipId, 'paySlipId')

    const mailPayload = await buildPaySlipMail(paySlipId)
    if (!mailPayload.to) {
      throw ApiError.failedPrecondition('Employee email is missing on this pay slip.')
    }

    await sendMail(mailPayload)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

emailRouter.post('/payslip-batch', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const payrollRunId = requireDocId((req.body as { payrollRunId?: unknown }).payrollRunId, 'payrollRunId')

    const slipsSnap = await getDb()
      .collection('paySlips')
      .where('payrollRunId', '==', payrollRunId)
      .limit(MAX_BATCH_SLIPS)
      .get()

    if (slipsSnap.empty) {
      throw ApiError.notFound('No pay slips found for this payroll run.')
    }

    let count = 0
    for (const slipDoc of slipsSnap.docs) {
      const mailPayload = await buildPaySlipMail(slipDoc.id)
      if (!mailPayload.to) continue
      await sendMail(mailPayload)
      count += 1
    }

    res.json({ success: true, count })
  } catch (err) {
    next(err)
  }
})
