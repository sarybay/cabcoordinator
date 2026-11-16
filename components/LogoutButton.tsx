'use client'

import { useTransition } from 'react'
import { logoutAction } from '@/app/auth/actions'

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => logoutAction())}
      disabled={isPending}
      className="text-sm text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
