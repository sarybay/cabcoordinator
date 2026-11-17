import Link from 'next/link'
import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import CreateProjectForm from '@/components/CreateProjectForm'
import DashboardCabActions from '@/components/DashboardCabActions'

export default async function DashboardPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()

  const { data: myDriver } = user
    ? await supabase.from('drivers').select('id, org_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single()
    : { data: null }

  const [{ data: org }, { data: projects }, { data: assignedCabs }] = await Promise.all([
    myDriver
      ? supabase.from('organisations').select('name').eq('id', myDriver.org_id).single()
      : Promise.resolve({ data: null }),
    myDriver
      ? supabase
          .from('projects')
          .select('id, name, created_at, last_updated_at, last_message_date, passengers(id, is_done, is_deleted)')
          .eq('org_id', myDriver.org_id)
          .order('last_updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    myDriver
      ? supabase
          .from('cabs')
          .select('id, label, color, started_at, is_done, project_id, passengers(id, name, arrival_date, arrival_time, origin, destination)')
          .eq('driver_id', myDriver.id)
          .eq('is_done', false)
          .order('label')
      : Promise.resolve({ data: [] }),
  ])

  // Fetch project names for the assigned cabs
  const projectIds = [...new Set((assignedCabs ?? []).map((c: { project_id: string }) => c.project_id))]
  const { data: cabProjects } = projectIds.length > 0
    ? await supabase.from('projects').select('id, name').in('id', projectIds)
    : { data: [] }
  const projectNameMap = new Map((cabProjects ?? []).map(p => [p.id, p.name]))

  // Group assigned cabs by project
  type CabRow = { id: string; label: string; color: string | null; started_at: string | null; is_done: boolean; project_id: string; passengers: { id: string; name: string | null; arrival_date: string | null; arrival_time: string | null; origin: string | null; destination: string | null }[] }
  const cabsByProject = new Map<string, { projectName: string; cabs: CabRow[] }>()
  for (const cab of (assignedCabs ?? []) as unknown as CabRow[]) {
    const pid = cab.project_id
    if (!cabsByProject.has(pid)) {
      cabsByProject.set(pid, { projectName: projectNameMap.get(pid) ?? 'Project', cabs: [] })
    }
    cabsByProject.get(pid)!.cabs.push(cab)
  }

  function daysUntilDeletion(lastUpdatedAt: string): number {
    const deleteAt = new Date(new Date(lastUpdatedAt).getTime() + 14 * 24 * 60 * 60 * 1000)
    return Math.ceil((deleteAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  }

  // Sort projects by earliest upcoming arrival date (future/today first, past dates sink to bottom)
  const today = new Date().toISOString().slice(0, 10)
  const sortedCabsByProject = Array.from(cabsByProject.entries()).sort(([, a], [, b]) => {
    const earliest = (cabs: CabRow[]) =>
      cabs.flatMap(c => c.passengers.map(p => p.arrival_date))
        .filter((d): d is string => !!d && d >= today)
        .sort()[0] ?? '9999'
    return earliest(a.cabs).localeCompare(earliest(b.cabs))
  })

  return (
    <div className="flex-1 overflow-auto px-8 py-8 max-w-3xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {org?.name ?? 'Organisation'}
          </p>
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        </div>
        <CreateProjectForm />
      </div>

      {/* Outstanding drives */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your drives</h2>
        {cabsByProject.size === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-5">
            <p className="text-sm text-gray-400">No drives assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCabsByProject.map(([pid, { projectName, cabs }]) => (
              <div key={pid} className="bg-white rounded-xl border border-gray-100 p-5">
                <Link href={`/project/${pid}`} className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 hover:text-gray-700 transition-colors block">{projectName}</Link>
                <ul className="space-y-3">
                  {cabs.map(cab => {
                    const times = cab.passengers.map(p => p.arrival_time?.slice(0, 5)).filter(Boolean)
                    const timeWindow = times.length > 0
                      ? times.length === 1 ? times[0] : `${times[0]} – ${times[times.length - 1]}`
                      : null
                    const date = cab.passengers.find(p => p.arrival_date)?.arrival_date
                    const fmtDate = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
                    const origins = [...new Set(cab.passengers.map(p => p.origin).filter(Boolean))]
                    const destinations = [...new Set(cab.passengers.map(p => p.destination).filter(Boolean))]
                    const from = origins.join(', ') || null
                    const to = destinations.join(', ') || null
                    return (
                      <li key={cab.id} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cab.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {cab.passengers.length} passenger{cab.passengers.length !== 1 ? 's' : ''}
                            {fmtDate ? ` · ${fmtDate}` : ''}
                            {timeWindow ? ` · ${timeWindow}` : ''}
                          </p>
                          {(from || to) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {from && <span>{from}</span>}
                              {from && to && <span className="mx-1">→</span>}
                              {to && <span>{to}</span>}
                            </p>
                          )}
                        </div>
                        <DashboardCabActions cabId={cab.id} startedAt={cab.started_at} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Projects</h2>
        {!projects || projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-8 py-16 text-center">
            <p className="text-gray-400 text-sm mb-1">No projects yet.</p>
            <p className="text-gray-400 text-sm">Create one to get started.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {projects.map(p => {
              type PaxRow = { id: string; is_done: boolean; is_deleted: boolean }
              const allPax = (p.passengers as unknown as PaxRow[]) ?? []
              const total = allPax.length
              const removed = allPax.filter(r => r.is_deleted).length
              const active = total - removed
              const done = allPax.filter(r => r.is_done && !r.is_deleted).length
              const allDone = active > 0 && done === active
              const pct = active > 0 ? Math.round((done / active) * 100) : 0
              const radius = 10
              const circ = 2 * Math.PI * radius
              const dash = (pct / 100) * circ

              return (
                <li key={p.id}>
                  <Link
                    href={`/project/${p.id}`}
                    className={`flex items-center justify-between rounded-xl border px-5 py-4 hover:border-gray-300 transition-colors group ${allDone ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100'}`}
                  >
                    <div>
                      <span className={`text-sm font-medium ${allDone ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                        {p.name}
                      </span>
                      {total > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {total} passenger{total !== 1 ? 's' : ''}
                          {removed > 0 && <span> · {active} active, {removed} removed</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          Updated {new Date(p.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {p.last_message_date && (
                          <p className="text-xs text-gray-300 mt-0.5">
                            Last msg {new Date(p.last_message_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                        {(() => {
                          const days = daysUntilDeletion(p.last_updated_at)
                          if (days > 7) return <p className="text-xs text-gray-300 mt-0.5">Deletes in {days}d</p>
                          if (days > 2) return <p className="text-xs text-amber-500 mt-0.5">Deletes in {days}d</p>
                          if (days > 0) return <p className="text-xs text-red-500 font-medium mt-0.5">Deletes in {days}d</p>
                          return <p className="text-xs text-red-500 font-medium mt-0.5">Deletion overdue</p>
                        })()}
                      </div>
                      {active > 0 && (
                        <div className="relative flex-shrink-0" title={`${done} of ${active} done`}>
                          <svg width="28" height="28" viewBox="0 0 28 28">
                            <circle cx="14" cy="14" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
                            <circle
                              cx="14" cy="14" r={radius} fill="none"
                              stroke={allDone ? '#9ca3af' : '#6366f1'}
                              strokeWidth="3"
                              strokeDasharray={`${dash} ${circ}`}
                              strokeLinecap="round"
                              transform="rotate(-90 14 14)"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-gray-500">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
