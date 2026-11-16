'use client'

import { useState, useTransition } from 'react'
import { updateOrgPaxSettings } from '@/app/actions'

interface Props {
  initialMin: number
  initialMax: number
}

export default function OrgPaxSettingsForm({ initialMin, initialMax }: Props) {
  const [min, setMin] = useState(String(initialMin))
  const [max, setMax] = useState(String(initialMax))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const minN = parseInt(min)
    const maxN = parseInt(max)
    if (isNaN(minN) || isNaN(maxN) || minN < 1 || maxN < minN) {
      setError('Max must be ≥ min, both ≥ 1')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateOrgPaxSettings(minN, maxN)
      if (res?.error) { setError(res.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="flex items-end gap-4 flex-wrap">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Min pax per cab
        <input
          type="number"
          min={1}
          value={min}
          onChange={e => setMin(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Max pax per cab
        <input
          type="number"
          min={1}
          value={max}
          onChange={e => setMax(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
      {error && <p className="text-xs text-red-500 w-full">{error}</p>}
    </div>
  )
}
