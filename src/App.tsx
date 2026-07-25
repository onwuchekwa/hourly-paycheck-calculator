import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CompanySettingsProvider } from './contexts/CompanySettingsContext'
import { DocumentTitle } from './components/DocumentTitle'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoadingSpinner } from './components/LoadingSpinner'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'

// Route-level code splitting keeps the initial bundle small; each page loads
// on first navigation. Public pages stay eager for instant first paint.
const EmployeeDashboard = lazy(() =>
  import('./pages/employee/EmployeeDashboard').then((m) => ({ default: m.EmployeeDashboard })),
)
const TimesheetPage = lazy(() =>
  import('./pages/employee/TimesheetPage').then((m) => ({ default: m.TimesheetPage })),
)
const TimeHistoryPage = lazy(() =>
  import('./pages/employee/TimeHistoryPage').then((m) => ({ default: m.TimeHistoryPage })),
)
const PaySlipsPage = lazy(() =>
  import('./pages/employee/PaySlipsPage').then((m) => ({ default: m.PaySlipsPage })),
)
const PaySlipDetailPage = lazy(() =>
  import('./pages/employee/PaySlipDetailPage').then((m) => ({ default: m.PaySlipDetailPage })),
)
const MockPaycheckPage = lazy(() =>
  import('./pages/employee/MockPaycheckPage').then((m) => ({ default: m.MockPaycheckPage })),
)
const AccountSettingsPage = lazy(() =>
  import('./pages/employee/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage })),
)
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)
const EmployeesPage = lazy(() =>
  import('./pages/admin/EmployeesPage').then((m) => ({ default: m.EmployeesPage })),
)
const TimeReviewPage = lazy(() =>
  import('./pages/admin/TimeReviewPage').then((m) => ({ default: m.TimeReviewPage })),
)
const PayPeriodsPage = lazy(() =>
  import('./pages/admin/PayPeriodsPage').then((m) => ({ default: m.PayPeriodsPage })),
)
const PayrollRunsPage = lazy(() =>
  import('./pages/admin/PayrollRunsPage').then((m) => ({ default: m.PayrollRunsPage })),
)
const PaySlipViewPage = lazy(() =>
  import('./pages/admin/PaySlipViewPage').then((m) => ({ default: m.PaySlipViewPage })),
)
const CompanySettingsPage = lazy(() =>
  import('./pages/admin/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)

function App() {
  return (
    <CompanySettingsProvider>
      <DocumentTitle />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner fullPage />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />

              <Route element={<ProtectedRoute role="employee" />}>
                <Route element={<Layout />}>
                  <Route path="/employee" element={<EmployeeDashboard />} />
                  <Route path="/employee/timesheet" element={<TimesheetPage />} />
                  <Route path="/employee/history" element={<TimeHistoryPage />} />
                  <Route path="/employee/pay-slips" element={<PaySlipsPage />} />
                  <Route path="/employee/pay-slips/:id" element={<PaySlipDetailPage />} />
                  <Route path="/employee/mock-paycheck" element={<MockPaycheckPage />} />
                  <Route path="/employee/settings" element={<AccountSettingsPage />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute role="admin" />}>
                <Route element={<Layout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/employees" element={<EmployeesPage />} />
                  <Route path="/admin/time-review" element={<TimeReviewPage />} />
                  <Route path="/admin/pay-periods" element={<PayPeriodsPage />} />
                  <Route path="/admin/payroll" element={<PayrollRunsPage />} />
                  <Route path="/admin/pay-slips" element={<PaySlipViewPage />} />
                  <Route path="/admin/settings" element={<CompanySettingsPage />} />
                  <Route path="/admin/reports" element={<ReportsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </CompanySettingsProvider>
  )
}

export default App
