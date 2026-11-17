import { createServerClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'

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

  // Generate the magic link server-side (bypasses Supabase's email sending)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email as string,
    options: { redirectTo: `${siteUrl}/auth/callback` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:0 auto">
        <h2 style="color:#c00">⚠️ Could not generate magic link</h2>
        <p>Error: ${linkError?.message ?? 'No link returned'}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const magicLink = linkData.properties.action_link

  // Send via Resend instead of relying on Supabase's email sender
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: row.email,
      subject: 'Your magic link to Cab Coordinator',
      html: `<p>You've been approved! Click the link below to sign in:</p>
             <p><a href="${magicLink}">Sign in to Cab Coordinator →</a></p>
             <p style="color:#999;font-size:12px">This link expires in 1 hour.</p>`,
    }),
  })

  if (!resendRes.ok) {
    const resendErr = await resendRes.text()
    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:0 auto">
        <h2 style="color:#c00">⚠️ Approved but email failed to send</h2>
        <p>Resend error: ${resendErr}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:0 auto">
      <h2 style="color:#111">✅ Access approved</h2>
      <p>A magic link has been sent to <strong>${row.email}</strong>.</p>
      <p style="color:#666;font-size:14px">They can now click that link to sign in and their account will be set up automatically.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
