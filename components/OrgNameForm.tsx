'use client'

import { useState, useTransition } from 'react'
import { updateOrgNameAction } from '@/app/actions'

export default function OrgNameForm({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateOrgNameAction(name.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-1">Organisation name</p>
        {editing ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              disabled={isPending} autoFocus required
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black w-64"
            />
            <button type="submit" disabled={!name.trim() || isPending}
              className="text-sm font-medium bg-black text-white rounded-lg px-3 py-1.5 disabled:opacity-30 hover:bg-gray-800 transition-colors">
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setName(currentName) }}
              className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        ) : (
          <p className="text-sm font-medium text-gray-900">{name}</p>
        )}
      </div>
      {!editing && (
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          {saved ? '✓ Saved' : 'Edit'}
        </button>
      )}
    </div>
  )
}
