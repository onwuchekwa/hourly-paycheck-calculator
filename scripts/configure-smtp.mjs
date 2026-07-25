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
The Node.js API in server/ sends email directly via your SMTP server.
No Firebase Blaze plan or Cloud Functions required.

Local setup
-----------
1. Choose an SMTP provider (Brevo, SendGrid, Mailgun, Amazon SES, etc.)

2. Copy server/.env.example to server/.env and fill in:
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_SIGN_IN_URL
   FIREBASE_SERVICE_ACCOUNT (full JSON from Firebase Console → Service accounts)
   ALLOWED_ORIGIN=http://localhost:5173

3. Copy .env.example to .env and set:
   VITE_API_URL=http://localhost:3001

4. Run the app:
   npm install
   npm install --prefix server
   npm run dev:app

5. Create an employee in Admin → Employees — the welcome email sends immediately.

Production (free tier)
----------------------
Firebase Spark (free): Auth + Firestore + Hosting
API on Vercel Hobby (free): deploy server/ with vercel.json

1. Deploy API to Vercel — set environment variables:
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_SIGN_IN_URL
   FIREBASE_SERVICE_ACCOUNT, ALLOWED_ORIGIN=https://your-app.web.app

2. Set GitHub secret VITE_API_URL to your Vercel API URL (e.g. https://your-api.vercel.app)

3. Deploy Firebase Hosting as usual (npm run build && firebase deploy --only hosting)

Recommended SMTP providers (free tiers)
---------------------------------------
• Brevo — smtp-relay.brevo.com:587 (300 emails/day free)
• SendGrid — smtp.sendgrid.net:587, user "apikey", pass = API key
• Mailgun — smtp.mailgun.org:587

Set Company email in Admin → Company Settings (used as reply-to on outgoing mail).
`

console.log(steps)
