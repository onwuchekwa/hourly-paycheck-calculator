import { defineSecret, defineString } from 'firebase-functions/params'

export const smtpHost = defineString('SMTP_HOST', { default: '' })
export const smtpPort = defineString('SMTP_PORT', { default: '587' })
export const smtpUser = defineString('SMTP_USER', { default: '' })
export const smtpPass = defineSecret('SMTP_PASS')
export const smtpFrom = defineString('SMTP_FROM', { default: 'HourlyPay <noreply@hourlypay.app>' })
export const appSignInUrl = defineString('APP_SIGN_IN_URL', { default: 'http://localhost:5173/login' })

export type MailDeliveryState = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'SKIPPED'

export interface MailMessage {
  subject: string
  html: string
  text: string
}

export interface MailDocument {
  to: string
  from?: string
  replyTo?: string
  message: MailMessage
  template?: 'welcome' | 'payslip'
  createdAt?: FirebaseFirestore.FieldValue
  delivery?: {
    state: MailDeliveryState
    error?: string
    attempts?: number
    sentAt?: FirebaseFirestore.Timestamp
    messageId?: string
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailLayout(title: string, bodyHtml: string, footerText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#1d4ed8;padding:24px 28px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">HourlyPay</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, href: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
      ${escapeHtml(label)}
    </a>
  </p>`
}

export function buildWelcomeEmail(params: {
  displayName: string
  email: string
  tempPassword: string
  signInUrl: string
  companyName: string
}): MailMessage {
  const { displayName, email, tempPassword, signInUrl, companyName } = params
  const subject = `Your ${companyName} payroll account is ready`
  const text = [
    `Hello ${displayName},`,
    '',
    `${companyName} has created your HourlyPay payroll account.`,
    '',
    `Username: ${email}`,
    `Temporary password: ${tempPassword}`,
    '',
    `Sign in: ${signInUrl}`,
    '',
    'You will be asked to change your password on first sign-in.',
    'If you did not expect this email, contact your employer.',
  ].join('\n')

  const html = emailLayout(
    subject,
    `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Welcome, ${escapeHtml(displayName)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
        <strong>${escapeHtml(companyName)}</strong> has created your HourlyPay account. Use the credentials below to sign in.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Username</p>
            <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;font-family:ui-monospace,monospace;">${escapeHtml(email)}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Temporary password</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;font-family:ui-monospace,monospace;">${escapeHtml(tempPassword)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#475569;">
        For security, you must choose a new password immediately after your first sign-in.
      </p>
      ${ctaButton('Sign in to HourlyPay', signInUrl)}
    `,
    'This message was sent by HourlyPay on behalf of your employer. Do not share your temporary password.',
  )

  return { subject, html, text }
}

export function buildPaySlipEmail(params: {
  employeeName: string
  paySlipNumber: string
  companyName: string
  payPeriodStart: string
  payPeriodEnd: string
  totalHours: number
  grossPay: number
  signInUrl: string
  lineRows: string
}): MailMessage {
  const {
    employeeName,
    paySlipNumber,
    companyName,
    payPeriodStart,
    payPeriodEnd,
    totalHours,
    grossPay,
    signInUrl,
    lineRows,
  } = params

  const subject = `Pay Slip ${paySlipNumber} — ${companyName}`
  const text = [
    `Hello ${employeeName},`,
    '',
    `Your pay slip ${paySlipNumber} for ${payPeriodStart} – ${payPeriodEnd} is ready.`,
    `Total hours: ${totalHours.toFixed(2)}`,
    `Gross pay: $${grossPay.toFixed(2)}`,
    '',
    `View your full pay slip: ${signInUrl}`,
  ].join('\n')

  const html = emailLayout(
    subject,
    `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Pay Slip ${escapeHtml(paySlipNumber)}</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569;">Employee: <strong>${escapeHtml(employeeName)}</strong></p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;">Period: ${escapeHtml(payPeriodStart)} – ${escapeHtml(payPeriodEnd)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr>
          <td style="padding:12px 16px;background:#eff6ff;border-radius:8px 8px 0 0;border:1px solid #bfdbfe;border-bottom:none;">
            <span style="font-size:13px;color:#1d4ed8;">Total hours</span>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e3a8a;">${totalHours.toFixed(2)}</p>
          </td>
          <td style="padding:12px 16px;background:#eff6ff;border-radius:8px 8px 0 0;border:1px solid #bfdbfe;border-bottom:none;">
            <span style="font-size:13px;color:#1d4ed8;">Gross pay</span>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e3a8a;">$${grossPay.toFixed(2)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:0 0 8px 8px;font-size:13px;">
        <tr style="background:#f8fafc;">
          <th align="left" style="color:#64748b;font-weight:600;">Date</th>
          <th align="right" style="color:#64748b;font-weight:600;">Hours</th>
          <th align="right" style="color:#64748b;font-weight:600;">Rate</th>
          <th align="right" style="color:#64748b;font-weight:600;">Amount</th>
        </tr>
        ${lineRows}
      </table>
      ${ctaButton('View full pay slip', signInUrl)}
    `,
    `${escapeHtml(companyName)} — sent via HourlyPay`,
  )

  return { subject, html, text }
}

export function isSmtpConfigured(): boolean {
  return Boolean(smtpHost.value().trim() && smtpUser.value().trim())
}
