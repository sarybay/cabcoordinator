'use server'

import { createAuthClient } from '@/lib/supabaseAuth'
import { createServerClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

async function userExistsByEmail(email: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error || !data) return false
  return data.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
}

export async function sendMagicLinkAction(
  email: string
): Promise<{ error?: string; pending?: true }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const supabase = createServerClient()

  // 1. Already a registered user → send OTP, no new account creation
  const exists = await userExistsByEmail(email)
  if (exists) {
    const authClient = await createAuthClient()
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: false,
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  // 2. Already approved in signup_requests → let them in
  const { data: approved } = await supabase
    .from('signup_requests')
    .select('id')
    .eq('email', email)
    .eq('status', 'approved')
    .maybeSingle()

  if (approved) {
    const authClient = await createAuthClient()
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  // 3. Already pending → tell them to wait
  const { data: pending } = await supabase
    .from('signup_requests')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()

  if (pending) {
    return { pending: true }
  }

  // 4. Unknown email → create request, email admin, return pending
  const { data: newRequest, error: insertError } = await supabase
    .from('signup_requests')
    .insert({ email })
    .select('token')
    .single()

  if (insertError || !newRequest) {
    return { error: insertError?.message ?? 'Failed to create request' }
  }

  const approveUrl = `${siteUrl}/api/approve-signup?token=${newRequest.token}`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: process.env.SUPER_ADMIN_EMAIL,
      subject: `Access request: ${email}`,
      html: `<p><strong>${email}</strong> has requested access to Cab Coordinator.</p>
             <p><a href="${approveUrl}">Approve access →</a></p>`,
    }),
  })

  return { pending: true }
}

export async function logoutAction() {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
