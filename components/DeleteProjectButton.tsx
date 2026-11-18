'use client'

import { useTransition } from 'react'
import { deleteProject } from '@/app/actions'

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Delete this project? All passengers and cabs will be permanently removed. This cannot be undone.')) return
    startTransition(() => deleteProject(projectId))
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-red-50"
    >
      {pending ? 'Deleting…' : 'Delete project'}
    </button>
  )
}
