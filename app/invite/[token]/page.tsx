import { createServerClient } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'
import InviteForm from './InviteForm'


export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServerClient()

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, registered_at')
    .eq('invite_token', token)
    .single()

  if (!driver) notFound()

  if (driver.registered_at) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already registered</h1>
          <p className="text-sm text-gray-500">You&apos;re already in the driver pool.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md">
        <div className="mb-8">
          <div className="w-11 h-11 bg-black rounded-xl flex items-center justify-center mb-5">
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">You&apos;ve been invited</h1>
          <p className="text-gray-500 text-sm">Enter your details to join as a driver.</p>
        </div>
        <InviteForm driverId={driver.id} />
      </div>
    </main>
  )
}
