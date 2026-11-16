'use client'

import { useState, useTransition } from 'react'
import { setCabStatus } from '@/app/actions'

interface Props {
  cabId: string
  startedAt: string | null
}

export default function DashboardCabActions({ cabId, startedAt }: Props) {
  const [started, setStarted] = useState(!!startedAt)
  const [isPending, startTransition] = useTransition()

  if (started) {
    return (
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await setCabStatus(cabId, 'done') })}
        className="text-xs font-medium bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Saving…' : 'Mark done'}
      </button>
    )
  }

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await setCabStatus(cabId, 'in_progress'); setStarted(true) })}
      className="text-xs font-medium border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40 transition-colors"
    >
      {isPending ? 'Saving…' : 'Start drive'}
    </button>
  )
}
