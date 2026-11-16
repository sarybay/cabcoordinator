'use client'

import { useState, useTransition } from 'react'
import { createCarType, deleteCarType } from '@/app/actions'
import type { CarType } from '@/lib/types'

interface Props {
  initialCarTypes: CarType[]
}

export default function CarTypesManager({ initialCarTypes }: Props) {
  const [carTypes, setCarTypes] = useState(initialCarTypes)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    const cap = parseInt(capacity)
    if (!name.trim() || isNaN(cap) || cap < 1) {
      setError('Enter a name and a valid max capacity')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCarType(name.trim(), cap)
      if (res?.error) { setError(res.error); return }
      setName('')
      setCapacity('')
    })
  }

  function handleDelete(id: string) {
    setCarTypes(prev => prev.filter(ct => ct.id !== id))
    startTransition(() => deleteCarType(id))
  }

  return (
    <div className="space-y-3">
      {carTypes.length === 0 ? (
        <p className="text-sm text-gray-400">No car types yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {carTypes.map(ct => (
            <li key={ct.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <span className="text-sm text-gray-800">{ct.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">max {ct.maxCapacity} pax</span>
                <button
                  onClick={() => handleDelete(ct.id)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Van Car"
            className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Max capacity
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            placeholder="6"
            className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add car type'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
