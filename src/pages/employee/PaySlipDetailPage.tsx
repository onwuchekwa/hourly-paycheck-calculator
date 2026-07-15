import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PaySlip } from '../../lib/types'
import { PaySlipDocument } from '../../components/PaySlipDocument'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function PaySlipDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [paySlip, setPaySlip] = useState<PaySlip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const snap = await getDoc(doc(db, 'paySlips', id))
      if (snap.exists()) {
        setPaySlip({ id: snap.id, ...snap.data() } as PaySlip)
      }
      setLoading(false)
    }
    void load()
  }, [id])

  if (loading) return <LoadingSpinner />
  if (!paySlip) return <p>Pay slip not found.</p>

  return (
    <div>
      <h1 className="page-title mb-6">Pay Slip Detail</h1>
      <PaySlipDocument paySlip={paySlip} />
    </div>
  )
}
