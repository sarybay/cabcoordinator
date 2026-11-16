'use client'

import { useState, useTransition } from 'react'
import { createPriceTier, deletePriceTier } from '@/app/actions'
import type { PriceTier } from '@/lib/types'

interface Props {
  initialPriceTiers: PriceTier[]
}

export default function PriceTiersManager({ initialPriceTiers }: Props) {
  const [tiers, setTiers] = useState(initialPriceTiers)
  const [minPax, setMinPax] = useState('')
  const [maxPax, setMaxPax] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    const min = parseInt(minPax)
    const max = parseInt(maxPax)
    const p = parseFloat(price)
    if (isNaN(min) || isNaN(max) || isNaN(p) || min < 1 || max < min || p <= 0) {
      setError('Enter valid values: max ≥ min ≥ 1, price > 0')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createPriceTier(min, max, p)
      if (res?.error) { setError(res.error); return }
      setMinPax('')
      setMaxPax('')
      setPrice('')
    })
  }

  function handleDelete(id: string) {
    setTiers(prev => prev.filter(t => t.id !== id))
    startTransition(() => deletePriceTier(id))
  }

  return (
    <div className="space-y-3">
      {tiers.length === 0 ? (
        <p className="text-sm text-gray-400">No price tiers yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {tiers.map(t => (
            <li key={t.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <span className="text-sm text-gray-800">
                {t.minPax}–{t.maxPax} pax
              </span>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">€{t.price}</span>
                <button
                  onClick={() => handleDelete(t.id)}
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
          Min pax
          <input
            type="number"
            min={1}
            value={minPax}
            onChange={e => setMinPax(e.target.value)}
            placeholder="1"
            className="w-16 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Max pax
          <input
            type="number"
            min={1}
            value={maxPax}
            onChange={e => setMaxPax(e.target.value)}
            placeholder="2"
            className="w-16 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Price (€)
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="50"
            className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add tier'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
