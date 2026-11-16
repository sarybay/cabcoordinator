import { createServerClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse('<p style="font-family:sans-serif;padding:2rem">Invalid link.</p>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createServerClient()

  const { data: row } = await supabase
    .from('signup_requests')
    .select('email, status')
    .eq('token', token)
    .maybeSingle()

  if (!row) {
    return new NextResponse(
      '<p style="font-family:sans-serif;padding:2rem">Link not found.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (row.status !== 'pending') {
    return new NextResponse(
      `<p style="font-family:sans-serif;padding:2rem">This link has already been used (status: ${row.status}).</p>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  await supabase
    .from('signup_requests')
    .update({ status: 'approved', actioned_at: new Date().toISOString() })
    .eq('token', token)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // Send the magic link via the anon client — Supabase creates the auth user on
  // first OTP send, which fires the handle_new_user trigger (org + membership).
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await anonClient.auth.signInWithOtp({
    email: row.email as string,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:0 auto">
      <h2 style="color:#111">✅ Access approved</h2>
      <p>A magic link has been sent to <strong>${row.email}</strong>.</p>
      <p style="color:#666;font-size:14px">They can now click that link to sign in and their account will be set up automatically.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
