'use server'

import { createServerClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

async function sendMagicLinkViaResend(
  forEmail: string,
  siteUrl: string,
  sendTo?: string
): Promise<{ error?: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: forEmail,
    options: { redirectTo: `${siteUrl}/auth/confirm` },
  })
  if (error || !data?.properties?.action_link) {
    return { error: error?.message ?? 'Failed to generate link' }
  }
  const recipient = sendTo ?? forEmail
  const isForwarding = recipient !== forEmail
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: recipient,
      subject: isForwarding ? `Magic link for ${forEmail}` : 'Your magic link to Cab Coordinator',
      html: isForwarding
        ? `<p>Magic link for <strong>${forEmail}</strong> — forward this to them:</p>
           <p><a href="${data.properties.action_link}">${data.properties.action_link}</a></p>
           <p style="color:#999;font-size:12px">Expires in 1 hour, single use.</p>`
        : `<p>Click the link below to sign in:</p>
           <p><a href="${data.properties.action_link}">Sign in to Cab Coordinator →</a></p>
           <p style="color:#999;font-size:12px">This link expires in 1 hour.</p>`,
    }),
  })
  if (!res.ok) return { error: `Email send failed: ${await res.text()}` }
  return {}
}

async function userExistsByEmail(email: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error || !data) return false
  return data.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
}

export async function sendMagicLinkAction(
  email: string
): Promise<{ error?: string; pending?: true; sentToAdmin?: true }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const supabase = createServerClient()

  // 1. Already a registered user → send magic link via Resend
  // If the email is the admin's own, send directly; otherwise route through admin for forwarding
  const exists = await userExistsByEmail(email)
  if (exists) {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL!
    const isAdmin = email.toLowerCase() === adminEmail.toLowerCase()
    const sendTo = isAdmin ? undefined : adminEmail
    const result = await sendMagicLinkViaResend(email, siteUrl, sendTo)
    if (result.error) return { error: result.error }
    return isAdmin ? {} : { sentToAdmin: true }
  }

  // 2. Already approved in signup_requests → generate link, send to admin for forwarding
  const { data: approved } = await supabase
    .from('signup_requests')
    .select('id')
    .eq('email', email)
    .eq('status', 'approved')
    .maybeSingle()

  if (approved) {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL!
    const result = await sendMagicLinkViaResend(email, siteUrl, adminEmail)
    if (result.error) return { error: result.error }
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
  const { createAuthClient } = await import('@/lib/supabaseAuth')
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
