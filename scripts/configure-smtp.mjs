#!/usr/bin/env node
/**
 * Prints SMTP setup steps for HourlyPay email delivery.
 *
 * Usage: node scripts/configure-smtp.mjs
 */

const steps = `
HourlyPay Email Setup
=====================

HourlyPay sends email when:
  • An employer creates a new employee (welcome email with temp password)
  • An admin emails a pay slip (or auto-emails on payroll finalize)

How it works
------------
Cloud Functions write to the Firestore "mail" collection.
The deliverMail function sends each document via your SMTP server.

Production setup
----------------
1. Choose an SMTP provider (SendGrid, Mailgun, Amazon SES, Gmail OAuth2, etc.)

2. Set function parameters:
   npx firebase-tools@latest functions:config:set \\
     smtp.host="smtp.sendgrid.net" \\
     smtp.port="587" \\
     smtp.user="apikey" \\
     smtp.from="HourlyPay <noreply@yourcompany.com>" \\
     app.sign_in_url="https://your-app.web.app/login"

   Or use Firebase params (recommended for Functions v2):
   npx firebase-tools@latest functions:secrets:set SMTP_PASS

3. Deploy functions:
   npx firebase-tools@latest deploy --only functions

4. Set company email in Admin → Company Settings (used as reply-to).

Local emulator testing
----------------------
1. Copy functions/.env.example to functions/.env
2. Create functions/.secret.local with: SMTP_PASS=your-password
3. Run: npm run dev:local
4. Create an employee — check Firestore "mail" collection in Emulator UI
   Delivery status is tracked in mail.delivery.state

Recommended providers
---------------------
• SendGrid — smtp.sendgrid.net:587, user "apikey", pass = API key
• Mailgun — smtp.mailgun.org:587
• Amazon SES — email-smtp.{region}.amazonaws.com:587

Verify delivery
---------------
After creating an employee, check:
  Firestore → mail → {doc} → delivery.state should be "SUCCESS"
If "SKIPPED", SMTP_HOST/SMTP_USER/SMTP_PASS are not configured.
If "ERROR", check delivery.error and Cloud Functions logs.
`

console.log(steps)
