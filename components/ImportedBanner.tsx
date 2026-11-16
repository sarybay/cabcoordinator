'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ImportedBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [count, setCount] = useState(0)

  const [cancelled, setCancelled] = useState(0)
  const [updated, setUpdated] = useState(0)

  useEffect(() => {
    const n = parseInt(searchParams.get('imported') ?? '')
    const c = parseInt(searchParams.get('cancelled') ?? '0')
    const u = parseInt(searchParams.get('updated') ?? '0')
    if (!isNaN(n)) {
      setCount(n)
      setCancelled(isNaN(c) ? 0 : c)
      setUpdated(isNaN(u) ? 0 : u)
      setVisible(true)
      router.replace(pathname, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  const parts: string[] = []
  if (count > 0)     parts.push(`${count} added`)
  if (updated > 0)   parts.push(`${updated} updated`)
  if (cancelled > 0) parts.push(`${cancelled} removed`)
  const message = parts.length > 0 ? parts.join(' · ') : 'No new messages — list is up to date.'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
      <span>{message}</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-1 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
