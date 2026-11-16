'use server'

import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'

export async function registerDriverAction(driverId: string, name: string, phone: string) {
  if (!name.trim()) return { error: 'Name is required' }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()
  const { error } = await supabase
    .from('drivers')
    .update({
      name: name.trim(),
      phone: phone.trim() || null,
      registered_at: new Date().toISOString(),
      user_id: user?.id ?? null,
    })
    .eq('id', driverId)
    .is('registered_at', null)

  if (error) return { error: error.message }
}
