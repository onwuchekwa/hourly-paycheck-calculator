import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConnectivity } from '../contexts/ConnectivityContext'
import { useCompanySettings } from '../contexts/CompanySettingsContext'
import { CompanyBranding } from './CompanyBranding'
import { MobileDrawer } from './ui/MobileDrawer'
import { classNames } from '../lib/utils'
import { isAdminRole } from '../lib/roles'
import { OfflineBanner } from './OfflineBanner'
import { OfflineEnrollmentPrompt } from './OfflineEnrollmentPrompt'

interface NavItem {
  to: string
  label: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const employeeNav: NavItem[] = [
  { to: '/employee', label: 'Dashboard' },
  { to: '/employee/timesheet', label: 'Timesheet' },
  { to: '/employee/history', label: 'Time History' },
  { to: '/employee/pay-slips', label: 'Pay Slips' },
  { to: '/employee/mock-paycheck', label: 'Earnings Preview' },
  { to: '/employee/settings', label: 'Account' },
]

const adminPrimaryNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/time-review', label: 'Time Review' },
]

const adminPayrollNav: NavGroup = {
  label: 'Payroll',
  items: [
    { to: '/admin/pay-periods', label: 'Pay Periods' },
    { to: '/admin/payroll', label: 'Payroll Runs' },
    { to: '/admin/pay-slips', label: 'Pay Slips' },
  ],
}

const adminSecondaryNav: NavItem[] = [
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/tax-settings', label: 'Tax Settings' },
]

function navLinkClass(isActive: boolean) {
  return classNames(
    'rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap',
    isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  )
}

function mobileNavLinkClass(isActive: boolean) {
  return classNames(
    'block rounded-lg px-3 py-3 text-base font-medium transition',
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-700 hover:bg-slate-50',
  )
}

function PayrollMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isActive = adminPayrollNav.items.some((item) => location.pathname.startsWith(item.to))

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={classNames(navLinkClass(isActive), 'inline-flex items-center gap-1.5')}
      >
        Payroll
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={classNames('h-4 w-4 transition', open ? 'rotate-180' : '')}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {adminPayrollNav.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive: itemActive }) =>
                classNames(
                  'block px-4 py-2 text-sm transition',
                  itemActive
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-slate-700 hover:bg-slate-50',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function UserBadge({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
      {initial}
    </span>
  )
}

function HamburgerButton({
  open,
  onClick,
  controlsId,
}: {
  open: boolean
  onClick: () => void
  controlsId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={open ? 'Close menu' : 'Open menu'}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 lg:hidden"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        {open ? (
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        ) : (
          <>
            <path strokeLinecap="round" d="M4 7h16" />
            <path strokeLinecap="round" d="M4 12h16" />
            <path strokeLinecap="round" d="M4 17h16" />
          </>
        )}
      </svg>
    </button>
  )
}

function MobileNavLinks({
  isAdmin,
  basePath,
  onNavigate,
}: {
  isAdmin: boolean
  basePath: string
  onNavigate: () => void
}) {
  return (
    <nav aria-label="Mobile navigation" className="space-y-1">
      {isAdmin ? (
        <>
          {adminPrimaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={onNavigate}
              className={({ isActive }) => mobileNavLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
          <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {adminPayrollNav.label}
          </p>
          {adminPayrollNav.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => mobileNavLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
          {adminSecondaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => mobileNavLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </>
      ) : (
        employeeNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === basePath}
            onClick={onNavigate}
            className={({ isActive }) => mobileNavLinkClass(isActive)}
          >
            {item.label}
          </NavLink>
        ))
      )}
    </nav>
  )
}

export function Layout() {
  const { profile, logout } = useAuth()
  const { mode } = useConnectivity()
  const { appTitle, logoDataUrl, showLogo } = useCompanySettings()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = isAdminRole(profile?.role)
  const basePath = isAdmin ? '/admin' : '/employee'
  const onTimesheet = location.pathname === '/employee/timesheet'
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuId = 'mobile-main-nav'

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (isAdmin) return
    if (mode !== 'offline' && mode !== 'degraded') return
    if (onTimesheet) return
    navigate('/employee/timesheet', { replace: true })
  }, [isAdmin, mode, onTimesheet, navigate])

  const handleLogout = async () => {
    setMobileOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <HamburgerButton
              open={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
              controlsId={mobileMenuId}
            />
            <Link to={basePath} className="min-w-0 shrink">
              <CompanyBranding
                name={appTitle}
                logoDataUrl={logoDataUrl}
                showLogo={showLogo}
                size="sm"
                nameClassName="text-brand-950"
                subtitle={
                  isAdmin ? (
                    <span className="hidden text-xs font-medium uppercase tracking-wide text-slate-500 sm:block">
                      Employer Portal
                    </span>
                  ) : undefined
                }
              />
            </Link>
          </div>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {isAdmin ? (
              <>
                {adminPrimaryNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
                <PayrollMenu />
                {adminSecondaryNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </>
            ) : (
              employeeNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === basePath}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))
            )}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            {profile?.displayName && <UserBadge name={profile.displayName} />}
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-slate-900">{profile?.displayName}</p>
              <p className="text-xs text-slate-500">{isAdmin ? 'Employer' : 'Employee'}</p>
            </div>
            <button type="button" onClick={handleLogout} className="btn-secondary px-3 py-2 text-xs">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        id={mobileMenuId}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Menu"
        footer={
          <div className="space-y-3">
            {profile?.displayName && (
              <div className="flex items-center gap-3 px-1">
                <UserBadge name={profile.displayName} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{profile.displayName}</p>
                  <p className="text-xs text-slate-500">{isAdmin ? 'Employer' : 'Employee'}</p>
                </div>
              </div>
            )}
            <button type="button" onClick={handleLogout} className="btn-secondary w-full">
              Sign out
            </button>
          </div>
        }
      >
        <MobileNavLinks
          isAdmin={isAdmin}
          basePath={basePath}
          onNavigate={() => setMobileOpen(false)}
        />
      </MobileDrawer>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 pb-safe sm:px-6 sm:py-8">
        <OfflineBanner />
        {!isAdmin && <OfflineEnrollmentPrompt />}
        <Outlet />
      </main>
    </div>
  )
}
