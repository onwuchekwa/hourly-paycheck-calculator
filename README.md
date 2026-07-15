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
- Trigger Email extension (mail collection)
- jsPDF + html2canvas for pay slip PDF export

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools` or use `npx firebase-tools@latest`
- A Firebase project with Blaze plan (for Cloud Functions + Trigger Email)

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

### 3. Install Trigger Email extension

```bash
npx firebase-tools@latest ext:install firebase/firestore-send-email
```

Configure the extension to watch the `mail` collection.

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

```bash
npm run dev
```

Open http://localhost:5173

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
- `FIREBASE_SERVICE_ACCOUNT` (JSON service account key)
- `FIREBASE_TOKEN` (for Firestore rules and Cloud Functions deploy on merge)

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
  src/index.ts    createEmployee, clearMustChangePassword, emailPaySlip
```

## Cloud Functions

| Function | Description |
|----------|-------------|
| `createEmployee` | Creates Auth user, Firestore profile, initial rate, welcome email |
| `clearMustChangePassword` | Clears `mustChangePassword` after password change |
| `emailPaySlip` | Sends pay slip summary via Trigger Email |

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
| `mail` | Trigger Email outbound queue |

## License

Private — internal use.
