import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'admin' | 'employer' | 'employee'

export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type PunchSource = 'button' | 'manual_edit' | 'auto_eod' | 'offline_sync'

export interface TimePunch {
  clockIn: Timestamp
  clockOut?: Timestamp | null
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  mustChangePassword?: boolean
  currentHourlyRate?: number
  createdBy?: string
  status?: 'active' | 'inactive'
  active?: boolean
  createdAt?: Timestamp
}

export interface EditHistoryEntry {
  editedAt: Timestamp
  editedBy: string
  editedByName: string
  reason: string
  previousPunches?: string | null
  newPunches?: string | null
  /** @deprecated legacy single-punch fields */
  previousClockIn?: string | null
  previousClockOut?: string | null
  newClockIn?: string | null
  newClockOut?: string | null
}

export interface TimeEntry {
  id: string
  employeeId: string
  employeeName: string
  workDate: string
  punches?: TimePunch[]
  /** @deprecated use punches; kept for lazy migration reads */
  clockIn?: Timestamp | null
  clockOut?: Timestamp | null
  status: TimeEntryStatus
  punchSource?: PunchSource
  editHistory?: EditHistoryEntry[]
  rejectionReason?: string
  submittedAt?: Timestamp
  approvedAt?: Timestamp
  rejectedAt?: Timestamp
  updatedAt?: Timestamp
}

export interface EmployeeRate {
  id: string
  employeeId: string
  employeeName?: string
  hourlyRate: number
  effectiveFrom: string
  createdAt?: Timestamp
  createdBy?: string
}

export type PayPeriodStatus = 'open' | 'closed'

export interface PayPeriod {
  id: string
  startDate: string
  endDate: string
  status: PayPeriodStatus
  createdAt?: Timestamp
  closedAt?: Timestamp
}

export type PayrollRunStatus = 'preview' | 'finalized'

export type PayrollRunType = 'regular' | 'supplemental'

export type PayrollRunScope = 'all' | 'selected'

export interface TaxRate {
  id: string
  rate: number
  effectiveFrom: string
  effectiveTo?: string | null
  createdAt?: Timestamp
  createdBy?: string
}

export interface TaxBreakdown {
  taxYear: number
  taxRate: number
  taxRateId?: string
  tax: number
  netPay: number
}

export interface PayrollLineItem {
  employeeId: string
  employeeName: string
  totalHours: number
  grossPay: number
  hourlyRate: number
  timeEntryIds: string[]
  dayBreakdown: PaySlipDayLine[]
  taxYear?: number
  taxRate?: number
  taxRateId?: string
  tax?: number
  netPay?: number
}

export interface PayrollRun {
  id: string
  payPeriodId: string
  payPeriodStart: string
  payPeriodEnd: string
  status: PayrollRunStatus
  runType?: PayrollRunType
  scope?: PayrollRunScope
  employeeIds?: string[]
  entries: PayrollLineItem[]
  totalGross: number
  totalHours: number
  taxYear?: number
  taxRate?: number
  taxRateId?: string
  totalTax?: number
  totalNetPay?: number
  createdAt?: Timestamp
  finalizedAt?: Timestamp
  createdBy?: string
}

export interface PaySlipDayLine {
  workDate: string
  hours: number
  rate: number
  amount: number
}

export interface MockPaycheckDayLine extends PaySlipDayLine {
  status: TimeEntryStatus
}

export interface MockPaycheckPreview {
  payPeriodId: string
  payPeriodStart: string
  payPeriodEnd: string
  employeeId: string
  employeeName: string
  totalHours: number
  grossPay: number
  hourlyRate: number
  dayBreakdown: MockPaycheckDayLine[]
  existingPaySlipId?: string
  includedPaidPeriods?: Array<{ id: string; startDate: string; endDate: string }>
  taxYear?: number
  taxRate?: number
  taxRateId?: string
  tax?: number
  netPay?: number
}

export interface PaySlip {
  id: string
  paySlipNumber: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  payPeriodId: string
  payPeriodStart: string
  payPeriodEnd: string
  payrollRunId: string
  totalHours: number
  hourlyRate: number
  grossPay: number
  payDate: string
  companyName: string
  companyAddress?: string
  companyPhone?: string
  lineItems: PaySlipDayLine[]
  taxYear?: number
  taxRate?: number
  taxRateId?: string
  tax?: number
  netPay?: number
  createdAt?: Timestamp
}

export interface CompanySettings {
  companyName: string
  address?: string
  phone?: string
  email?: string
  paySlipCounterYear?: number
  paySlipCounter?: number
}
