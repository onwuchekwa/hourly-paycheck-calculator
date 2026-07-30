import { useState, type FormEvent } from 'react'
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useTaxSettings } from '../../contexts/TaxSettingsContext'
import { db } from '../../lib/firebase'
import { prepareAddTaxRate, formatTaxRateLabel } from '../../lib/tax'
import { formatDisplayDate, todayString } from '../../lib/utils'
import { AlertBanner } from '../../components/AlertBanner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { PageHeader, ResponsiveTable, type ResponsiveTableColumn } from '../../components/ui'
import type { TaxRate } from '../../lib/types'

export function TaxSettingsPage() {
  const { user } = useAuth()
  const { rates, loading, activeRate, refreshRates } = useTaxSettings()
  const [rateInput, setRateInput] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageVariant, setMessageVariant] = useState<'success' | 'error'>('success')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const parsedRate = Number.parseFloat(rateInput)
  const rateValid = !Number.isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 100

  const endInfo = rateValid && effectiveFrom
    ? prepareAddTaxRate(effectiveFrom, rates)
    : { endPreviousId: null, effectiveTo: null }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!rateValid) {
      setMessageVariant('error')
      setMessage('Enter a tax rate between 0 and 100.')
      return
    }
    if (!effectiveFrom.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setMessageVariant('error')
      setMessage('Enter a valid effective from date.')
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmAdd = async () => {
    if (!rateValid) return
    setSaving(true)
    setMessage('')
    try {
      const { endPreviousId, effectiveTo } = prepareAddTaxRate(effectiveFrom, rates)
      const batch = writeBatch(db)

      if (endPreviousId && effectiveTo) {
        batch.update(doc(db, 'taxRates', endPreviousId), {
          effectiveTo,
          updatedAt: serverTimestamp(),
        })
      }

      const newRef = doc(collection(db, 'taxRates'))
      batch.set(newRef, {
        rate: Math.round(parsedRate * 100) / 100,
        effectiveFrom,
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? '',
      })

      await batch.commit()
      await refreshRates()
      setRateInput('')
      setEffectiveFrom(todayString())
      setMessageVariant('success')
      setMessage('Tax rate added.')
      setConfirmOpen(false)
    } catch {
      setMessageVariant('error')
      setMessage('Failed to add tax rate.')
    } finally {
      setSaving(false)
    }
  }

  const columns: ResponsiveTableColumn<TaxRate>[] = [
    {
      key: 'rate',
      header: 'Rate',
      render: (r) => <span className="font-medium">{formatTaxRateLabel(r.rate)}</span>,
    },
    {
      key: 'from',
      header: 'Effective From',
      render: (r) => formatDisplayDate(r.effectiveFrom),
    },
    {
      key: 'to',
      header: 'Effective To',
      render: (r) => (r.effectiveTo ? formatDisplayDate(r.effectiveTo) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={
            r.effectiveTo == null || r.effectiveTo === ''
              ? 'inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
              : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
          }
        >
          {r.effectiveTo == null || r.effectiveTo === '' ? 'Active' : 'Ended'}
        </span>
      ),
    },
  ]

  if (loading) return <LoadingSpinner />

  const confirmDescription =
    endInfo.endPreviousId && activeRate && endInfo.effectiveTo
      ? `This will end the current rate (${formatTaxRateLabel(activeRate.rate)}) effective ${formatDisplayDate(endInfo.effectiveTo)}. The new rate (${formatTaxRateLabel(parsedRate)}) takes effect ${formatDisplayDate(effectiveFrom)}.`
      : `The new rate (${formatTaxRateLabel(parsedRate)}) will take effect ${formatDisplayDate(effectiveFrom)}.`

  return (
    <div>
      <PageHeader
        title="Tax Settings"
        subtitle="Manage the payroll tax rate. Adding a new rate automatically ends the current one."
      />

      {activeRate && (
        <div className="card mt-6 max-w-lg">
          <p className="text-sm text-slate-500">Current rate</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{formatTaxRateLabel(activeRate.rate)}</p>
          <p className="mt-1 text-sm text-slate-600">
            Effective since {formatDisplayDate(activeRate.effectiveFrom)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card mt-8 max-w-lg space-y-4">
        <h2 className="font-semibold text-slate-900">Add Tax Rate</h2>
        {message && <AlertBanner variant={messageVariant}>{message}</AlertBanner>}
        <div>
          <label htmlFor="taxRate" className="label-field">
            Tax rate (%)
          </label>
          <input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="input-field"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            placeholder="e.g. 16.65"
            required
          />
        </div>
        <div>
          <label htmlFor="effectiveFrom" className="label-field">
            Effective from
          </label>
          <input
            id="effectiveFrom"
            type="date"
            className="input-field"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={saving || !rateValid} className="btn-primary">
          Add Tax Rate
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Rate History</h2>
        {rates.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No tax rates configured yet.</p>
        ) : (
          <div className="mt-4">
            <ResponsiveTable columns={columns} rows={rates} keyField="id" />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Add tax rate?"
        description={confirmDescription}
        confirmLabel="Add Rate"
        busy={saving}
        onConfirm={() => void handleConfirmAdd()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
