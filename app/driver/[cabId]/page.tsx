import { createServerClient } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'
import MarkDoneButton from '@/components/MarkDoneButton'
import StartDriveButton from '@/components/StartDriveButton'


export default async function DriverPage({ params }: { params: Promise<{ cabId: string }> }) {
  const { cabId } = await params
  const supabase = createServerClient()

  const { data: cab } = await supabase
    .from('cabs')
    .select('*, passengers(*), drivers(name)')
    .eq('id', cabId)
    .single()

  if (!cab) notFound()

  const passengers = (cab.passengers as Array<Record<string, unknown>> ?? [])
    .sort((a, b) => {
      if (!a.arrival_time) return 1
      if (!b.arrival_time) return -1
      return (a.arrival_time as string).localeCompare(b.arrival_time as string)
    })

  const driverName = (cab.drivers as { name: string } | null)?.name ?? (cab.driver_name as string | null)

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-12 px-6">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{cab.label as string}</h1>
          {driverName && (
            <p className="text-gray-500 mt-1">Driver: <span className="font-medium text-gray-700">{driverName}</span></p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {passengers.length === 0 ? (
            <p className="text-sm text-gray-400 p-5 text-center">No passengers assigned.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {passengers.map(p => (
                <li key={p.id as string} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{(p.name as string) ?? 'Unknown'}</p>
                    <p className="text-sm text-gray-400 mt-0.5 font-mono">{(p.flight_number as string) ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700">{(p.arrival_time as string) ?? '—'}</p>
                    {p.arrival_date != null && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(p.arrival_date as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cab.is_done ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-green-700 font-semibold">Drive complete ✓</p>
          </div>
        ) : cab.started_at ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-amber-700 font-medium text-sm">On the way…</p>
            </div>
            <MarkDoneButton cabId={cabId} />
          </div>
        ) : (
          <div className="space-y-3">
            <StartDriveButton cabId={cabId} />
            <MarkDoneButton cabId={cabId} />
          </div>
        )}
      </div>
    </main>
  )
}
