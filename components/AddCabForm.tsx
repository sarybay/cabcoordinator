'use client'

import { useState, useTransition } from 'react'
import { addCab } from '@/app/actions'

interface Props {
  projectId: string
  cabCount: number
}

export default function AddCabForm({ projectId, cabCount }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [label, setLabel] = useState(`Cab ${cabCount + 1}`)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!label.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addCab(projectId, label)
      if ('error' in result) { setError(result.error); return }
      setExpanded(false)
      setLabel(`Cab ${cabCount + 2}`)
    })
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-400 rounded-lg px-3 py-2 w-full transition-colors"
      >
        + Add cab
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') setExpanded(false) }}
        autoFocus
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setExpanded(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="text-xs font-medium bg-gray-900 text-white rounded-lg px-3 py-1 hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
