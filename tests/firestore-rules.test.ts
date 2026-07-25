/**
 * Firestore security rules tests.
 *
 * Run with the emulator:
 *   npm run test:rules
 * (wraps `firebase emulators:exec --only firestore "vitest run tests"`)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'rules-test'

const ADMIN_UID = 'admin1'
const EMP_UID = 'emp1'
const OTHER_EMP_UID = 'emp2'
const INACTIVE_UID = 'emp3'

const WORK_DATE = '2026-07-20'
const ENTRY_ID = `${EMP_UID}_${WORK_DATE}`

let testEnv: RulesTestEnvironment

function db(uid: string | null) {
  if (!uid) return testEnv.unauthenticatedContext().firestore()
  return testEnv.authenticatedContext(uid).firestore()
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore()
    await admin.doc(`users/${ADMIN_UID}`).set({
      role: 'admin', displayName: 'Admin', email: 'admin@x.test', active: true,
    })
    await admin.doc(`users/${EMP_UID}`).set({
      role: 'employee', displayName: 'Emp One', email: 'e1@x.test', active: true,
      mustChangePassword: false,
    })
    await admin.doc(`users/${OTHER_EMP_UID}`).set({
      role: 'employee', displayName: 'Emp Two', email: 'e2@x.test', active: true,
    })
    await admin.doc(`users/${INACTIVE_UID}`).set({
      role: 'employee', displayName: 'Emp Three', email: 'e3@x.test', active: false,
    })

    await admin.doc(`timeEntries/${ENTRY_ID}`).set({
      employeeId: EMP_UID, employeeName: 'Emp One', workDate: WORK_DATE,
      status: 'draft', punches: [],
    })
    await admin.doc(`timeEntries/${OTHER_EMP_UID}_${WORK_DATE}`).set({
      employeeId: OTHER_EMP_UID, employeeName: 'Emp Two', workDate: WORK_DATE,
      status: 'submitted', punches: [],
    })

    await admin.doc('employeeRates/rate1').set({
      employeeId: EMP_UID, hourlyRate: 20, effectiveFrom: '2026-01-01',
    })
    await admin.doc('employeeRates/rate2').set({
      employeeId: OTHER_EMP_UID, hourlyRate: 55, effectiveFrom: '2026-01-01',
    })

    await admin.doc(`paySlips/run1_${EMP_UID}`).set({
      employeeId: EMP_UID, employeeName: 'Emp One', grossPay: 100, totalHours: 5,
    })
    await admin.doc(`paySlips/run1_${OTHER_EMP_UID}`).set({
      employeeId: OTHER_EMP_UID, employeeName: 'Emp Two', grossPay: 900, totalHours: 40,
    })

    await admin.doc('settings/company').set({ companyName: 'Test Co' })
    await admin.doc('settings/payroll').set({ lastPaySlipNumber: 3 })
    await admin.doc('payPeriods/p1').set({ startDate: '2026-07-16', endDate: '2026-07-31', status: 'open' })
    await admin.doc('payrollRuns/run1').set({ status: 'finalized', totalGross: 1000 })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await seed()
})

describe('timeEntries — employee self-approval is blocked', () => {
  it('denies employee setting their own entry to approved', async () => {
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({ status: 'approved' }),
    )
  })

  it('denies employee creating an entry that is already approved', async () => {
    const id = `${EMP_UID}_2026-07-21`
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${id}`).set({
        employeeId: EMP_UID, employeeName: 'Emp One', workDate: '2026-07-21',
        status: 'approved', punches: [],
      }),
    )
  })

  it('denies employee writing admin review fields', async () => {
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        status: 'submitted', approvedAt: new Date(), reviewedBy: EMP_UID,
      }),
    )
  })

  it('denies employee changing employeeId or workDate', async () => {
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({ employeeId: OTHER_EMP_UID }),
    )
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({ workDate: '2026-07-22' }),
    )
  })
})

describe('timeEntries — legitimate employee flows still work', () => {
  it('allows creating a draft entry with the {uid}_{workDate} id', async () => {
    const id = `${EMP_UID}_2026-07-21`
    await assertSucceeds(
      db(EMP_UID).doc(`timeEntries/${id}`).set({
        employeeId: EMP_UID, employeeName: 'Emp One', workDate: '2026-07-21',
        status: 'draft', punches: [], updatedAt: new Date(),
      }),
    )
  })

  it('denies creating an entry under a mismatched doc id', async () => {
    await assertFails(
      db(EMP_UID).doc('timeEntries/whatever').set({
        employeeId: EMP_UID, employeeName: 'Emp One', workDate: '2026-07-21',
        status: 'draft', punches: [],
      }),
    )
  })

  it('denies creating an entry for another employee', async () => {
    const id = `${OTHER_EMP_UID}_2026-07-21`
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${id}`).set({
        employeeId: OTHER_EMP_UID, employeeName: 'Emp Two', workDate: '2026-07-21',
        status: 'draft', punches: [],
      }),
    )
  })

  it('allows clock in/out punch updates', async () => {
    await assertSucceeds(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        punches: [{ clockIn: new Date(), clockOut: null }],
        clockIn: null, clockOut: null, punchSource: 'button', updatedAt: new Date(),
      }),
    )
  })

  it('allows submitting for review', async () => {
    await assertSucceeds(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        status: 'submitted', submittedAt: new Date(),
        rejectionReason: null, rejectedAt: null, updatedAt: new Date(),
      }),
    )
  })

  it('allows a session edit with a valid edit reason', async () => {
    await assertSucceeds(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        punches: [{ clockIn: new Date(), clockOut: new Date() }],
        clockIn: null, clockOut: null, punchSource: 'manual_edit',
        editHistory: [{
          editedAt: new Date(), editedBy: EMP_UID, editedByName: 'Emp One',
          reason: 'Forgot to clock out at end of shift',
          previousPunches: '[]', newPunches: '[]',
        }],
        updatedAt: new Date(),
      }),
    )
  })

  it('denies a session edit with a too-short edit reason', async () => {
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        punches: [{ clockIn: new Date(), clockOut: new Date() }],
        clockIn: null, clockOut: null, punchSource: 'manual_edit',
        editHistory: [{
          editedAt: new Date(), editedBy: EMP_UID, editedByName: 'Emp One',
          reason: 'oops',
        }],
        updatedAt: new Date(),
      }),
    )
  })

  it('denies updating an approved entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`timeEntries/${ENTRY_ID}`).update({ status: 'approved' })
    })
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        punches: [], updatedAt: new Date(),
      }),
    )
  })

  it('denies reading another employee\'s entry', async () => {
    await assertFails(
      db(EMP_UID).doc(`timeEntries/${OTHER_EMP_UID}_${WORK_DATE}`).get(),
    )
  })
})

describe('timeEntries — admin review', () => {
  it('allows admin approving a submitted entry', async () => {
    await assertSucceeds(
      db(ADMIN_UID).doc(`timeEntries/${OTHER_EMP_UID}_${WORK_DATE}`).update({
        status: 'approved', approvedAt: new Date(), reviewedAt: new Date(),
        reviewedBy: ADMIN_UID, updatedAt: new Date(),
      }),
    )
  })

  it('allows admin rejecting a submitted entry with a reason', async () => {
    await assertSucceeds(
      db(ADMIN_UID).doc(`timeEntries/${OTHER_EMP_UID}_${WORK_DATE}`).update({
        status: 'rejected', rejectionReason: 'Overlapping sessions',
        rejectedAt: new Date(), reviewedAt: new Date(),
        reviewedBy: ADMIN_UID, updatedAt: new Date(),
      }),
    )
  })

  it('denies admin approving a draft entry', async () => {
    await assertFails(
      db(ADMIN_UID).doc(`timeEntries/${ENTRY_ID}`).update({
        status: 'approved', approvedAt: new Date(), reviewedAt: new Date(),
        reviewedBy: ADMIN_UID, updatedAt: new Date(),
      }),
    )
  })
})

describe('employeeRates — wage privacy', () => {
  it('denies employee reading another employee\'s rate', async () => {
    await assertFails(db(EMP_UID).doc('employeeRates/rate2').get())
  })

  it('allows employee querying their own rates', async () => {
    await assertSucceeds(
      db(EMP_UID).collection('employeeRates').where('employeeId', '==', EMP_UID).get(),
    )
  })

  it('allows admin reading all rates', async () => {
    await assertSucceeds(db(ADMIN_UID).doc('employeeRates/rate2').get())
  })

  it('denies employee creating a rate', async () => {
    await assertFails(
      db(EMP_UID).collection('employeeRates').add({
        employeeId: EMP_UID, hourlyRate: 999, effectiveFrom: '2026-01-01',
      }),
    )
  })
})

describe('deactivated accounts are denied', () => {
  it('denies inactive employee reading pay periods', async () => {
    await assertFails(db(INACTIVE_UID).doc('payPeriods/p1').get())
  })

  it('denies inactive employee creating a time entry', async () => {
    const id = `${INACTIVE_UID}_${WORK_DATE}`
    await assertFails(
      db(INACTIVE_UID).doc(`timeEntries/${id}`).set({
        employeeId: INACTIVE_UID, employeeName: 'Emp Three', workDate: WORK_DATE,
        status: 'draft', punches: [],
      }),
    )
  })

  it('denies inactive employee querying their own rates', async () => {
    await assertFails(
      db(INACTIVE_UID).collection('employeeRates')
        .where('employeeId', '==', INACTIVE_UID).get(),
    )
  })
})

describe('users — role escalation is blocked', () => {
  it('denies employee changing their own role', async () => {
    await assertFails(
      db(EMP_UID).doc(`users/${EMP_UID}`).update({ role: 'admin' }),
    )
  })

  it('denies employee changing their own hourly rate', async () => {
    await assertFails(
      db(EMP_UID).doc(`users/${EMP_UID}`).update({ currentHourlyRate: 999 }),
    )
  })

  it('allows employee updating their display name', async () => {
    await assertSucceeds(
      db(EMP_UID).doc(`users/${EMP_UID}`).update({
        displayName: 'New Name', updatedAt: new Date(),
      }),
    )
  })

  it('denies employee reading another user\'s profile', async () => {
    await assertFails(db(EMP_UID).doc(`users/${OTHER_EMP_UID}`).get())
  })
})

describe('paySlips and payroll data', () => {
  it('denies employee reading another employee\'s pay slip', async () => {
    await assertFails(db(EMP_UID).doc(`paySlips/run1_${OTHER_EMP_UID}`).get())
  })

  it('allows employee reading their own pay slip', async () => {
    await assertSucceeds(db(EMP_UID).doc(`paySlips/run1_${EMP_UID}`).get())
  })

  it('denies employee writing pay slips', async () => {
    await assertFails(
      db(EMP_UID).doc(`paySlips/run1_${EMP_UID}`).update({ grossPay: 99999 }),
    )
  })

  it('denies employee reading payroll runs', async () => {
    await assertFails(db(EMP_UID).doc('payrollRuns/run1').get())
  })
})

describe('settings', () => {
  it('allows unauthenticated read of the public company doc', async () => {
    await assertSucceeds(db(null).doc('settings/company').get())
  })

  it('denies unauthenticated read of other settings docs', async () => {
    await assertFails(db(null).doc('settings/payroll').get())
  })

  it('denies employee writing settings', async () => {
    await assertFails(
      db(EMP_UID).doc('settings/company').update({ companyName: 'Hacked' }),
    )
  })
})
