'use client'

import { useState, useTransition } from 'react'
import { createDriverInviteAction } from '@/app/actions'

export default function InviteDriverButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createDriverInviteAction(email.trim())
      if ('error' in result) {
        setError(result.error)
      } else {
        setSent(true)
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setEmail('')
    setError(null)
    setSent(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium bg-black text-white rounded-lg px-3.5 py-2 hover:bg-gray-800 transition-colors"
      >
        + Invite driver
      </button>
    )
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
        <span className="text-sm text-green-700">Invite sent to <strong>{email}</strong></span>
        <button onClick={handleClose} className="text-xs text-green-600 underline">Done</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="driver@example.com"
        required
        disabled={isPending}
        autoFocus
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400 w-56"
      />
      <button
        type="submit"
        disabled={!email.trim() || isPending}
        className="text-sm font-medium bg-black text-white rounded-lg px-3.5 py-2 hover:bg-gray-800 transition-colors disabled:opacity-30"
      >
        {isPending ? 'Sending…' : 'Send invite'}
      </button>
      <button
        type="button"
        onClick={handleClose}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
