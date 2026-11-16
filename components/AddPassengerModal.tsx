'use client'

import { useState, useTransition } from 'react'
import type { Cab } from '@/lib/types'
import { addPassenger, addCab } from '@/app/actions'

interface Props {
  projectId: string
  cabs: Cab[]
}

const FIELD_CLASS = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
const LABEL_CLASS = 'flex flex-col gap-1 text-sm text-gray-700'

export default function AddPassengerModal({ projectId, cabs }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [flight, setFlight] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [details, setDetails] = useState('')
  const [cabId, setCabId] = useState<string>('')
  const [newCabLabel, setNewCabLabel] = useState(`Cab ${cabs.length + 1}`)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName(''); setPhone(''); setFlight(''); setArrivalDate('')
    setArrivalTime(''); setOrigin(''); setDestination(''); setDetails('')
    setCabId(''); setNewCabLabel(`Cab ${cabs.length + 1}`); setError(null)
  }

  function handleClose() { reset(); setOpen(false) }

  function handleSubmit() {
    if (!name.trim() && !flight.trim()) {
      setError('Enter at least a name or flight number')
      return
    }
    setError(null)
    startTransition(async () => {
      let resolvedCabId: string | null = cabId === '' ? null : cabId === '__new__' ? null : cabId

      if (cabId === '__new__') {
        const result = await addCab(projectId, newCabLabel || `Cab ${cabs.length + 1}`)
        if ('error' in result) { setError(result.error); return }
        resolvedCabId = result.id
      }

      const result = await addPassenger(projectId, {
        name, phone, flightNumber: flight, arrivalDate, arrivalTime,
        origin, destination, additionalDetails: details,
        cabId: resolvedCabId,
      })
      if (result?.error) { setError(result.error); return }
      handleClose()
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 transition-colors"
      >
        + Add passenger
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Add passenger</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                Name
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Turner" className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Phone
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 900101" className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Flight number
                <input value={flight} onChange={e => setFlight(e.target.value)} placeholder="BA2201" className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Arrival date
                <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Arrival time
                <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                From
                <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="London Heathrow" className={FIELD_CLASS} />
              </label>
              <label className={`${LABEL_CLASS} col-span-2`}>
                To
                <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Berlin" className={FIELD_CLASS} />
              </label>
              <label className={`${LABEL_CLASS} col-span-2`}>
                Additional details
                <textarea value={details} onChange={e => setDetails(e.target.value)} rows={2} placeholder="Wheelchair, luggage notes…" className={`${FIELD_CLASS} resize-none`} />
              </label>
              <label className={`${LABEL_CLASS} col-span-2`}>
                Cab
                <select value={cabId} onChange={e => setCabId(e.target.value)} className={FIELD_CLASS}>
                  <option value="">— No cab —</option>
                  {cabs.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  <option value="__new__">+ New cab…</option>
                </select>
              </label>
              {cabId === '__new__' && (
                <label className={`${LABEL_CLASS} col-span-2`}>
                  New cab label
                  <input value={newCabLabel} onChange={e => setNewCabLabel(e.target.value)} className={FIELD_CLASS} />
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Adding…' : 'Add passenger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
