import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../lib/firebase'
import type { TimeEntry } from '../../lib/types'
import { calcHours, formatDisplayDate, formatTime } from '../../lib/utils'
import { StatusBadge } from '../../components/StatusBadge'
import { LoadingSpinner } from '../../components/LoadingSpinner'

export function TimeHistoryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      const q = query(
        collection(db, 'timeEntries'),
        where('employeeId', '==', profile.uid),
        orderBy('workDate', 'desc'),
      )
      const snap = await getDocs(q)
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeEntry))
      setLoading(false)
    }
    void load()
  }, [profile])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="page-title">Time History</h1>
      <p className="page-subtitle">All your recorded time entries.</p>

      {entries.length === 0 ? (
        <p className="mt-8 text-slate-600">No time entries yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">In</th>
                <th className="pb-3 pr-4 font-medium">Out</th>
                <th className="pb-3 pr-4 font-medium">Hours</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{formatDisplayDate(e.workDate)}</td>
                  <td className="py-3 pr-4">{formatTime(e.clockIn)}</td>
                  <td className="py-3 pr-4">{formatTime(e.clockOut)}</td>
                  <td className="py-3 pr-4">{calcHours(e.clockIn, e.clockOut).toFixed(2)}</td>
                  <td className="py-3"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
