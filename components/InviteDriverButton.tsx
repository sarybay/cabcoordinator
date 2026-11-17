'use client'

import { useState, useTransition } from 'react'
import { createDriverInviteAction } from '@/app/actions'

export default function InviteDriverButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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
        setInviteLink(result.inviteLink)
      }
    })
  }

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setOpen(false)
    setEmail('')
    setError(null)
    setInviteLink(null)
    setCopied(false)
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

  if (inviteLink) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 w-full max-w-lg">
        <p className="text-sm font-medium text-green-800 mb-1">
          Invite link for <strong>{email}</strong>
        </p>
        <p className="text-xs text-green-700 mb-2">Copy and send this link to the driver via WhatsApp or email. It expires in 1 hour.</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 border border-green-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700 bg-white font-mono truncate focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="text-xs font-medium bg-green-700 text-white rounded-md px-3 py-1.5 hover:bg-green-800 transition-colors whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button onClick={handleClose} className="mt-3 text-xs text-green-600 underline">Done</button>
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
        {isPending ? 'Generating…' : 'Get invite link'}
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
