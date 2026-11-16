'use client'

import { useTransition } from 'react'
import { markCabStarted } from '@/app/actions'

export default function StartDriveButton({ cabId }: { cabId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => markCabStarted(cabId))}
      disabled={isPending}
      className="w-full bg-amber-500 text-white rounded-2xl py-4 text-base font-semibold disabled:opacity-30 hover:bg-amber-600 transition-colors"
    >
      {isPending ? 'Updating…' : 'On my way →'}
    </button>
  )
}
