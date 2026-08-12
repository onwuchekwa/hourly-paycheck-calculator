import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { apiPost } from '../../lib/api'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { resolveCompanyField, resolveCompanyName, resolveLogoDataUrl, resolveShowLogo } from '../../lib/companyBranding'
import { CompanyBranding } from '../../components/CompanyBranding'
import { getCallableErrorMessage } from '../../lib/errors'
import { formatDisplayDate } from '../../lib/utils'
import { useCompanySettings } from '../../contexts/CompanySettingsContext'
import { AlertBanner } from '../../components/AlertBanner'
import { PaySlipDocument } from '../../components/PaySlipDocument'
import { PaySlipSummaryTable } from '../../components/PaySlipSummaryTable'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { EmptyState, PageHeader } from '../../components/ui'

export function PaySlipViewPage() {
  const [searchParams] = useSearchParams()
  const runId = searchParams.get('run')
  const { settings } = useCompanySettings()
  const [slips, setSlips] = useState<PaySlip[]>([])
  const [selected, setSelected] = useState<PaySlip | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailing, setEmailing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'success' | 'error'>('success')
  const [loadError, setLoadError] = useState('')

  const companyName = resolveCompanyName(slips[0]?.companyName, settings.companyName)
  const companyAddress = resolveCompanyField(slips[0]?.companyAddress, settings.address)
  const companyPhone = resolveCompanyField(slips[0]?.companyPhone, settings.phone)
  const snapshot = slips[0]
  const hasLogo = Boolean(snapshot?.companyLogoDataUrl?.trim() || settings.logoDataUrl?.trim())
  const showCompanyLogo = resolveShowLogo(snapshot?.showCompanyLogo, settings.showLogo, hasLogo)
  const logoDataUrl = resolveLogoDataUrl(
    snapshot?.companyLogoDataUrl,
    settings.logoDataUrl,
    showCompanyLogo,
  )

  useEffect(() => {
    const load = async () => {
      try {
        const constraints = runId ? [where('payrollRunId', '==', runId)] : []
        const q = query(collection(db, 'paySlips'), ...constraints, orderBy('paySlipNumber', 'desc'))
        const snap = await getDocs(q)
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PaySlip)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        setSlips(list)
        setSelected(null)
      } catch {
        setLoadError('Failed to load pay slips.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [runId])

  const handleSelect = (slip: PaySlip) => {
    setSelected((current) => (current?.id === slip.id ? null : slip))
    setMessage('')
  }

  const handleEmail = async () => {
    if (!selected) return
    setEmailing(true)
    setMessage('')
    try {
      await apiPost<{ success: boolean }>('/api/email/payslip', { paySlipId: selected.id })
      setMessageVariant('success')
      setMessage(`Pay slip emailed to ${selected.employeeEmail}`)
    } catch (err) {
      setMessageVariant('error')
      setMessage(getCallableErrorMessage(err, 'Failed to send email.'))
    } finally {
      setEmailing(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const periodLabel =
    slips.length > 0
      ? `${formatDisplayDate(slips[0].payPeriodStart)} – ${formatDisplayDate(slips[0].payPeriodEnd)}`
      : null

  return (
    <div>
      <PageHeader
        title="Pay Slips"
        subtitle={
          runId
            ? 'Payroll run summary by employee. Open details to print or email an individual pay slip.'
            : 'Summary of all generated pay slips. Open details to print or email an individual pay slip.'
        }
      />

      {loadError && <AlertBanner variant="error" className="mt-4">{loadError}</AlertBanner>}

      {slips.length === 0 && !loadError ? (
        <div className="mt-8">
          <EmptyState title="No pay slips found" />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="card">
            <div className="border-b border-slate-200 pb-4 mb-4">
              <CompanyBranding
                name={companyName}
                logoDataUrl={logoDataUrl}
                showLogo={showCompanyLogo}
                size="lg"
                subtitle={
                  <>
                    {companyAddress && (
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{companyAddress}</p>
                    )}
                    {companyPhone && <p className="mt-1 text-sm text-slate-600">{companyPhone}</p>}
                    {periodLabel && (
                      <p className="mt-2 text-sm font-medium text-brand-700">Pay period: {periodLabel}</p>
                    )}
                  </>
                }
              />
            </div>

            <PaySlipSummaryTable slips={slips} selectedId={selected?.id} onSelect={handleSelect} />
          </div>

          {selected && (
            <div>
              <div className="no-print mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {selected.employeeName} — {selected.paySlipNumber}
                </h2>
                <button type="button" onClick={handleEmail} disabled={emailing} className="btn-secondary">
                  {emailing ? 'Sending…' : 'Email Pay Slip'}
                </button>
                {message && (
                  <AlertBanner variant={messageVariant} className="flex-1">
                    {message}
                  </AlertBanner>
                )}
              </div>
              <PaySlipDocument paySlip={selected} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
