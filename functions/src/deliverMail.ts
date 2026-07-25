import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import * as logger from 'firebase-functions/logger'
import nodemailer from 'nodemailer'
import {
  isSmtpConfigured,
  smtpFrom,
  smtpHost,
  smtpPass,
  smtpPort,
  smtpUser,
  type MailDocument,
} from './email'

const db = getFirestore()

async function sendViaSmtp(mail: MailDocument): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: smtpHost.value(),
    port: Number(smtpPort.value()),
    secure: Number(smtpPort.value()) === 465,
    auth: {
      user: smtpUser.value(),
      pass: smtpPass.value(),
    },
  })

  const info = await transporter.sendMail({
    from: mail.from ?? smtpFrom.value(),
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.message.subject,
    text: mail.message.text,
    html: mail.message.html,
  })

  return info.messageId ?? 'unknown'
}

export const deliverMail = onDocumentCreated(
  {
    document: 'mail/{mailId}',
    secrets: [smtpPass],
  },
  async (event) => {
    const snap = event.data
    if (!snap) return

    const mail = snap.data() as MailDocument
    const mailId = snap.id
    const attempts = (mail.delivery?.attempts ?? 0) + 1

    if (mail.delivery?.state === 'SUCCESS') {
      return
    }

    await snap.ref.update({
      delivery: { state: 'PROCESSING', attempts },
    })

    if (!isSmtpConfigured()) {
      logger.warn(
        `Mail ${mailId} queued but SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.`,
      )
      await snap.ref.update({
        delivery: {
          state: 'SKIPPED',
          error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on Cloud Functions.',
          attempts,
        },
      })
      return
    }

    try {
      const messageId = await sendViaSmtp(mail)
      await snap.ref.update({
        delivery: {
          state: 'SUCCESS',
          messageId,
          sentAt: FieldValue.serverTimestamp(),
          attempts,
        },
      })
      logger.info(`Mail ${mailId} sent to ${mail.to}`, { messageId })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown send error'
      logger.error(`Mail ${mailId} failed`, err)
      await snap.ref.update({
        delivery: {
          state: 'ERROR',
          error: errorMessage,
          attempts,
        },
      })
    }
  },
)

export async function queueMail(
  mail: Omit<MailDocument, 'delivery' | 'createdAt'>,
): Promise<string> {
  const ref = await db.collection('mail').add({
    ...mail,
    delivery: { state: 'PENDING', attempts: 0 },
    createdAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}
