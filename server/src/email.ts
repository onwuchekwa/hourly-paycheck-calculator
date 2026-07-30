import nodemailer from 'nodemailer'

export interface MailMessage {
  subject: string
  html: string
  text: string
}

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

export function getAppSignInUrl(): string {
  return env('APP_SIGN_IN_URL', 'http://localhost:5173/login')
}

export function isSmtpConfigured(): boolean {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'))
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip CR/LF so DB-sourced strings can never inject SMTP headers. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
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
  tax?: number
  taxRate?: number
  taxYear?: number
  netPay?: number
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
    tax,
    taxRate,
    taxYear,
    netPay,
    signInUrl,
    lineRows,
  } = params

  const taxLines =
    tax != null && netPay != null
      ? [
          taxRate != null ? `Tax (${taxRate}%): $${tax.toFixed(2)}` : `Tax: $${tax.toFixed(2)}`,
          `Net pay: $${netPay.toFixed(2)}`,
        ]
      : []

  const subject = `Pay Slip ${paySlipNumber} — ${companyName}`
  const text = [
    `Hello ${employeeName},`,
    '',
    `Your pay slip ${paySlipNumber} for ${payPeriodStart} – ${payPeriodEnd} is ready.`,
    taxYear != null ? `Tax year: ${taxYear}` : '',
    `Total hours: ${totalHours.toFixed(2)}`,
    `Gross pay: $${grossPay.toFixed(2)}`,
    ...taxLines,
    '',
    `View your full pay slip: ${signInUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const taxHtml =
    tax != null && netPay != null
      ? `<tr>
          <td style="padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-top:none;">
            <span style="font-size:13px;color:#b91c1c;">Tax${taxRate != null ? ` (${taxRate}%)` : ''}</span>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#991b1b;">−$${tax.toFixed(2)}</p>
          </td>
          <td style="padding:12px 16px;background:#ecfdf5;border:1px solid #bbf7d0;border-top:none;">
            <span style="font-size:13px;color:#15803d;">Net pay</span>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#166534;">$${netPay.toFixed(2)}</p>
          </td>
        </tr>`
      : ''

  const html = emailLayout(
    subject,
    `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Pay Slip ${escapeHtml(paySlipNumber)}</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569;">Employee: <strong>${escapeHtml(employeeName)}</strong></p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;">Period: ${escapeHtml(payPeriodStart)} – ${escapeHtml(payPeriodEnd)}${taxYear != null ? ` · Tax year ${taxYear}` : ''}</p>
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
        ${taxHtml}
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

export async function sendMail(params: {
  to: string
  replyTo?: string
  message: MailMessage
}): Promise<string> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in server/.env')
  }

  const port = Number(env('SMTP_PORT', '587'))
  const transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: port === 465,
    auth: {
      user: env('SMTP_USER'),
      pass: env('SMTP_PASS'),
    },
  })

  const info = await transporter.sendMail({
    from: env('SMTP_FROM', 'HourlyPay <noreply@hourlypay.app>'),
    to: sanitizeHeader(params.to),
    replyTo: params.replyTo ? sanitizeHeader(params.replyTo) : undefined,
    subject: sanitizeHeader(params.message.subject),
    text: params.message.text,
    html: params.message.html,
  })

  return info.messageId ?? 'unknown'
}
