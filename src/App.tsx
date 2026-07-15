import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard'
import { TimesheetPage } from './pages/employee/TimesheetPage'
import { TimeHistoryPage } from './pages/employee/TimeHistoryPage'
import { PaySlipsPage } from './pages/employee/PaySlipsPage'
import { PaySlipDetailPage } from './pages/employee/PaySlipDetailPage'
import { AccountSettingsPage } from './pages/employee/AccountSettingsPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { EmployeesPage } from './pages/admin/EmployeesPage'
import { TimeReviewPage } from './pages/admin/TimeReviewPage'
import { PayPeriodsPage } from './pages/admin/PayPeriodsPage'
import { PayrollRunsPage } from './pages/admin/PayrollRunsPage'
import { PaySlipViewPage } from './pages/admin/PaySlipViewPage'
import { CompanySettingsPage } from './pages/admin/CompanySettingsPage'
import { ReportsPage } from './pages/admin/ReportsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
