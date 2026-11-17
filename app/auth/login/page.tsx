'use client'

import { useState, useTransition } from 'react'
import { sendMagicLinkAction } from '@/app/auth/actions'

type State = false | 'sent' | 'pending'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await sendMagicLinkAction(email)
      if (result?.error) setError(result.error)
      else if (result?.pending) setState('pending')
      else setState('sent')
    })
  }

  if (state === 'pending') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🕐</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Request received</h1>
          <p className="text-sm text-gray-500">
            Your access request for <span className="font-medium text-gray-700">{email}</span> has been submitted.
            The admin will review it and you&apos;ll receive a magic link once approved.
          </p>
          <button
            onClick={() => { setState(false); setEmail('') }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  if (state === 'sent') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h1>
          <p className="text-sm text-gray-500">
            We sent a magic link to <span className="font-medium text-gray-700">{email}</span>.
            Click it to sign in — no password needed.
          </p>
          <button
            onClick={() => { setState(false); setEmail('') }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-gray-500 text-sm">We&apos;ll email you a magic link — no password needed.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required disabled={isPending}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={isPending}
            className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-gray-800 transition-colors"
          >
            {isPending ? 'Sending…' : 'Send magic link →'}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-400 text-center">
          New here? Enter your email to request access.
        </p>
      </div>
    </main>
  )
}
