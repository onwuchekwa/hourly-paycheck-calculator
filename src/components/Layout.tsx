import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { classNames } from '../lib/utils'
import { isAdminRole } from '../lib/roles'

interface NavItem {
  to: string
  label: string
}

const employeeNav: NavItem[] = [
  { to: '/employee', label: 'Dashboard' },
  { to: '/employee/timesheet', label: 'Timesheet' },
  { to: '/employee/history', label: 'Time History' },
  { to: '/employee/pay-slips', label: 'Pay Slips' },
  { to: '/employee/mock-paycheck', label: 'Earnings Preview' },
  { to: '/employee/settings', label: 'Account' },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/time-review', label: 'Time Review' },
  { to: '/admin/pay-periods', label: 'Pay Periods' },
  { to: '/admin/payroll', label: 'Payroll Runs' },
  { to: '/admin/pay-slips', label: 'Pay Slips' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/settings', label: 'Company' },
]

export function Layout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const nav = isAdminRole(profile?.role) ? adminNav : employeeNav
  const basePath = isAdminRole(profile?.role) ? '/admin' : '/employee'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to={basePath} className="text-lg font-bold text-brand-800">
            HourlyPay
          </Link>
          <nav aria-label="Main navigation" className="hidden gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === basePath}
                className={({ isActive }) =>
                  classNames(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {profile?.displayName}
            </span>
            <button type="button" onClick={handleLogout} className="btn-secondary text-xs">
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === basePath}
              className={({ isActive }) =>
                classNames(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
