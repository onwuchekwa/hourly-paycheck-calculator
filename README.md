# HourlyPay — Hourly Payroll Calculator

A Firebase-powered hourly payroll application for small teams. Employers manage employees, review time, run payroll, and distribute pay slips. Employees clock in/out, submit timesheets, and view pay history.

## Features

- **Auth**: Email/password only (no Google, no self-registration)
- **Employees**: Created by employer via API with temp password + welcome email
- **Forced password change** on first login
- **Timesheet**: Calendar picker, clock in/out buttons, one entry per day, manual edits with audit trail
- **Rate history**: Per-employee rates with effective dates
- **Payroll**: Pay periods, preview/finalize runs, auto-generated pay slips (PS-YYYY-NNNNN)
- **Reports**: CSV export for employers
- **YTD gross** on employee dashboard

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Firebase Spark (Auth, Firestore, Hosting) — **no Blaze plan required**
- Node.js API (`server/`) with Nodemailer SMTP for email
- jsPDF + html2canvas for pay slip PDF export

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools` or use `npx firebase-tools@latest`
- An SMTP provider with a free tier (Brevo, SendGrid, Mailgun, etc.)

## Setup

### 1. Create Firebase project (Spark / free plan)

```bash
npx firebase-tools@latest login
npx firebase-tools@latest use your-project-id
```

In Firebase Console:

1. **Authentication** → Sign-in method → Enable **Email/Password** only (disable Google)
2. **Firestore** → Create database (production mode)

### 2. Configure email (SMTP)

HourlyPay sends welcome emails when employees are created and pay slip emails on demand or after payroll finalize.

```bash
node scripts/configure-smtp.mjs   # prints full setup guide
cp server/.env.example server/.env
cp .env.example .env
```

Fill in `server/.env` with SMTP credentials and your Firebase service account JSON.
Set `VITE_API_URL=http://localhost:3001` in `.env`.

Set **Company email** in Admin → Company Settings (used as reply-to on outgoing mail).

### 3. Install dependencies

```bash
npm install
npm install --prefix server
```

### 4. Deploy Firestore rules and indexes

```bash
npx firebase-tools@latest deploy --only firestore
```

### 5. Create employer account

**Option A — Firebase Console (manual)**

1. Authentication → Add user (email + password)
2. Firestore → `users/{uid}`:

```json
{
  "email": "admin@company.com",
  "displayName": "Admin User",
  "role": "admin",
  "mustChangePassword": false,
  "status": "active",
  "active": true
}
```

3. Firestore → `settings/company`:

```json
{
  "companyName": "My Company",
  "address": "123 Main St"
}
```

4. Firestore → `settings/payroll`:

```json
{
  "lastPaySlipNumber": 0,
  "paySlipCounterYear": 2026
}
```

**Option B — Script**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
npx tsx scripts/createEmployer.ts --email admin@company.com --name "Admin User" --password "securepass123"
```

### 6. Run locally

**Option A — Real Firebase project + local API (recommended)**

```bash
npm run dev:app
```

Runs the API on http://localhost:3001 and Vite on http://localhost:5173.

**Option B — Firebase Emulators (optional, no cloud writes)**

Requires **Java 11+** for the Firestore emulator.

```bash
# Set VITE_USE_FIREBASE_EMULATORS=true in .env
npm run dev:local
npm run seed:emulator
```

Sign in with **admin@local.test** / **password123**. Emulator UI: http://localhost:4000

### 7. Deploy

**Firebase Hosting + Firestore (Spark / free):**

```bash
npm run build
npx firebase-tools@latest deploy --only hosting,firestore
```

**API (Vercel Hobby / free):**

Deploy the repo to Vercel. Set environment variables in the Vercel dashboard:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_SIGN_IN_URL`
- `FIREBASE_SERVICE_ACCOUNT` (full JSON)
- `ALLOWED_ORIGIN` (your Hosting URL)

Set `VITE_API_URL` to your Vercel API URL when building the web app.

## GitHub Actions CI/CD

Add these repository secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL` (your deployed API URL)
- `FIREBASE_SERVICE_ACCOUNT` (JSON service account key)

- **Pull requests** → Firebase Hosting preview channel
- **Push to `main`** → deploy Firestore rules and live Hosting

Deploy the API separately to Vercel (or run it locally for development).

## Project Structure

```
src/
  components/     Shared UI
  contexts/       AuthContext
  lib/            Firebase config, API client, payroll logic
  pages/          Employee and admin pages
server/
  src/
    index.ts          Express API entry
    email.ts          HTML email templates + SMTP send
    routes/           employees, email endpoints
functions/          (deprecated — replaced by server/)
```

## API endpoints

| Route | Description |
|-------|-------------|
| `POST /api/employees` | Creates Auth user, Firestore profile, initial rate, sends welcome email |
| `POST /api/email/payslip` | Emails a single pay slip |
| `POST /api/email/payslip-batch` | Emails all pay slips for a payroll run |

All routes require a Firebase ID token in the `Authorization: Bearer` header.

## Collections

| Collection | Purpose |
|------------|---------|
| `users` | Employer and employee profiles |
| `timeEntries` | Daily time records (`{employeeId}_{workDate}`) |
| `employeeRates` | Hourly rate history |
| `payPeriods` | Pay period definitions |
| `payrollRuns` | Preview/finalized payroll snapshots |
| `paySlips` | Generated pay slips |
| `settings/company` | Company info for pay slips |
| `settings/payroll` | Pay slip number counter |

## License

Private — internal use.
