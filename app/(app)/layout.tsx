import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import LogoutButton from '@/components/LogoutButton'
import Sidebar from '@/components/Sidebar'
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()
  const { data: membership } = user
    ? await supabase.from('memberships').select('org_id').eq('user_id', user.id).limit(1).single()
    : { data: null }

  const { data: org } = membership
    ? await supabase.from('organisations').select('name').eq('id', membership.org_id).single()
    : { data: null }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">{org?.name ?? 'Cab Coordinator'}</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-500">{user.email}</span>
          )}
          <LogoutButton />
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
