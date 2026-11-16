'use client'

import { useTransition } from 'react'
import { markCabDone } from '@/app/actions'

export default function MarkDoneButton({ cabId }: { cabId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => markCabDone(cabId))}
      disabled={isPending}
      className="w-full bg-black text-white rounded-2xl py-4 text-base font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Saving…' : 'Mark drive done'}
    </button>
  )
}
