# HourlyPay — Hourly Payroll Calculator

A Firebase-powered hourly payroll application for small teams. Employers manage employees, review time, run payroll, and distribute pay slips. Employees clock in/out, submit timesheets, and view pay history.

## Features

- **Auth**: Email/password only (no Google, no self-registration)
- **Employees**: Created by employer via Cloud Function with temp password + welcome email
- **Forced password change** on first login
- **Timesheet**: Calendar picker, clock in/out buttons, one entry per day, manual edits with audit trail
- **Rate history**: Per-employee rates with effective dates
- **Payroll**: Pay periods, preview/finalize runs, auto-generated pay slips (PS-YYYY-NNNNN)
- **Reports**: CSV export for employers
- **YTD gross** on employee dashboard

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Firebase (Auth, Firestore, Cloud Functions, Hosting)
- Nodemailer SMTP delivery via Cloud Functions (mail collection queue)
- jsPDF + html2canvas for pay slip PDF export

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools` or use `npx firebase-tools@latest`
- A Firebase project with Blaze plan (for Cloud Functions)
- An SMTP provider (SendGrid, Mailgun, Amazon SES, etc.) for sending emails

## Setup

### 1. Create Firebase project

```bash
npx firebase-tools@latest login
npx firebase-tools@latest projects:create your-project-id --display-name "HourlyPay"
npx firebase-tools@latest use your-project-id
```

### 2. Enable services

In Firebase Console:

1. **Authentication** → Sign-in method → Enable **Email/Password** only (disable Google)
2. **Firestore** → Create database (production mode)
3. **Functions** → Enable (requires Blaze plan)

### 3. Configure email (SMTP)

HourlyPay sends welcome emails when employees are created and pay slip emails on demand or after payroll finalize.

```bash
node scripts/configure-smtp.mjs   # prints full setup guide
cp functions/.env.example functions/.env   # for local emulators
```

**Production:**

```bash
# Set SMTP password as a secret
npx firebase-tools@latest functions:secrets:set SMTP_PASS

# Deploy — set other params during deploy or in Firebase Console → Functions → Environment
# SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_FROM, APP_SIGN_IN_URL
npx firebase-tools@latest deploy --only functions
```

Set **Company email** in Admin → Company Settings (used as reply-to on outgoing mail).

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in values from Firebase Console → Project Settings → Your apps → Web app config.

### 5. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 6. Deploy Firestore rules and indexes

```bash
npx firebase-tools@latest deploy --only firestore
```

### 7. Deploy Cloud Functions

```bash
npx firebase-tools@latest deploy --only functions
```

### 8. Create employer account

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

### 9. Run locally

HourlyPay is a **Firebase client app**. `npm run dev` only starts the Vite UI — auth, Firestore data, and Cloud Functions still need Firebase (local emulators or a cloud project).

**Option A — Firebase Emulators (no cloud project)**

Requires **Java 11+** for the Firestore emulator.

```bash
cp .env.example .env
# Set VITE_USE_FIREBASE_EMULATORS=true (see .env.example)
npm run dev:local
npm run seed:emulator
```

Open http://localhost:5173 and sign in with **admin@local.test** / **password123**.

Emulator UI: http://localhost:4000

**Option B — Real Firebase project (no Java needed)**

```bash
cp .env.example .env
# Fill in Firebase Console web app config; set VITE_USE_FIREBASE_EMULATORS=false
npm run dev
```

Create an employer account (see step 8), then sign in.

### 10. Build & deploy hosting

```bash
npm run build
npx firebase-tools@latest deploy --only hosting
```

## GitHub Actions CI/CD

Add these repository secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON service account key — used for Firestore, Functions, and Hosting deploys)

- **Pull requests** → Firebase Hosting preview channel
- **Push to `main`** → deploy Firestore rules, Cloud Functions, and live Hosting

## Project Structure

```
src/
  components/     Shared UI (Layout, StatusBadge, PaySlipDocument, etc.)
  contexts/       AuthContext
  lib/            Firebase config, types, payroll logic
  pages/
    employee/     Dashboard, Timesheet, TimeHistory, PaySlips, Settings
    admin/        Dashboard, Employees, TimeReview, Payroll, Reports
functions/
  src/
    index.ts        createEmployee, emailPaySlip, emailPaySlipsBatch
    email.ts        HTML email templates
    deliverMail.ts  Firestore trigger — sends queued mail via SMTP
```

## Cloud Functions

| Function | Description |
|----------|-------------|
| `createEmployee` | Creates Auth user, Firestore profile, initial rate, queues welcome email |
| `clearMustChangePassword` | Clears `mustChangePassword` after password change |
| `emailPaySlip` | Queues a single pay slip email |
| `emailPaySlipsBatch` | Queues pay slip emails for all slips in a payroll run |
| `deliverMail` | Firestore trigger — delivers queued `mail` documents via SMTP |

## Email delivery

1. Callable functions write to the `mail` collection with `delivery.state: PENDING`
2. `deliverMail` trigger sends via SMTP and updates `delivery.state` to `SUCCESS` or `ERROR`
3. Check Firestore `mail` documents to verify delivery status

| `delivery.state` | Meaning |
|------------------|---------|
| `PENDING` | Queued, waiting for trigger |
| `PROCESSING` | Currently sending |
| `SUCCESS` | Delivered |
| `ERROR` | SMTP failed — see `delivery.error` |
| `SKIPPED` | SMTP not configured |

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
| `mail` | Outbound email queue (processed by `deliverMail` trigger) |

## License

Private — internal use.
