'use client'

import { useState, useTransition } from 'react'
import { updateProfileAction } from '@/app/actions'

interface Props {
  currentName: string
  currentPhone: string | null
  email: string
}

export default function ProfileForm({ currentName, currentPhone, email }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [phone, setPhone] = useState(currentPhone ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateProfileAction(name.trim(), phone.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  function handleCancel() {
    setEditing(false)
    setName(currentName)
    setPhone(currentPhone ?? '')
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Name</p>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  disabled={isPending} autoFocus required
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black w-72"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Phone</p>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  disabled={isPending} placeholder="+44 7700 900000"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black w-72 placeholder:text-gray-400"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-sm text-gray-500">{email}</p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit" disabled={!name.trim() || isPending}
                  className="text-sm font-medium bg-black text-white rounded-lg px-3.5 py-2 disabled:opacity-30 hover:bg-gray-800 transition-colors"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={handleCancel} className="text-sm text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Name</p>
                <p className="text-sm font-medium text-gray-900">{name}</p>
              </div>
              {phone && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                  <p className="text-sm text-gray-700">{phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Email</p>
                <p className="text-sm text-gray-500">{email}</p>
              </div>
            </>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors ml-4 mt-1">
            {saved ? '✓ Saved' : 'Edit'}
          </button>
        )}
      </div>
    </div>
  )
}
