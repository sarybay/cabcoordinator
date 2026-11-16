'use client'

import { useState, useTransition } from 'react'
import { registerDriverAction } from './actions'

export default function InviteForm({ driverId }: { driverId: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await registerDriverAction(driverId, name.trim(), phone.trim())
      if (result?.error) setError(result.error)
      else setDone(true)
    })
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">You&apos;re registered!</h2>
        <p className="text-sm text-gray-500">The admin will assign you to a cab.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Full name" required disabled={isPending}
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+44 7700 900000" disabled={isPending}
          className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <button
        type="submit" disabled={!name.trim() || isPending}
        className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-gray-800 transition-colors"
      >
        {isPending ? 'Registering…' : 'Register as driver →'}
      </button>
    </form>
  )
}
