'use client'

import { useState, useTransition } from 'react'
import { createProject } from '@/app/actions'

export default function CreateProjectForm() {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(() => createProject(name.trim()))
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New project
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Conference Berlin June"
        autoFocus
        disabled={isPending}
        className="border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400 w-72"
      />
      <button
        type="submit"
        disabled={!name.trim() || isPending}
        className="bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-gray-800 transition-colors"
      >
        {isPending ? 'Creating…' : 'Create →'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setName('') }}
        className="text-sm text-gray-400 hover:text-gray-700 transition-colors px-2"
      >
        Cancel
      </button>
    </form>
  )
}
