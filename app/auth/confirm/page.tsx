'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function handleConfirm() {
      // Handle PKCE code flow (?code=...)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { router.replace('/dashboard'); return }
      }

      // Handle implicit/hash flow (#access_token=...)
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (!error) { router.replace('/dashboard'); return }
        }
      }

      // Fall back: check if session already exists
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { router.replace('/dashboard'); return }

      router.replace('/auth/login')
    }

    handleConfirm()
  }, [router])

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Signing you in…</p>
    </main>
  )
}
