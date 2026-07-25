import { Router } from 'express'
import { assertAdmin, getCompanySettings, requireAuth, type AuthedRequest } from '../auth.js'
import { getDb } from '../admin.js'
import { ApiError } from '../errors.js'
import { buildPaySlipEmail, getAppSignInUrl, sendMail } from '../email.js'

export const emailRouter = Router()

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
    message,
  }
}

emailRouter.post('/payslip', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req as AuthedRequest
    await assertAdmin(uid)

    const { paySlipId } = req.body as { paySlipId?: string }
    if (!paySlipId) {
      throw ApiError.invalidArgument('paySlipId is required.')
    }

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

    const { payrollRunId } = req.body as { payrollRunId?: string }
    if (!payrollRunId) {
      throw ApiError.invalidArgument('payrollRunId is required.')
    }

    const slipsSnap = await getDb()
      .collection('paySlips')
      .where('payrollRunId', '==', payrollRunId)
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
