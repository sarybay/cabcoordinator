import PassengerTable from '@/components/PassengerTable'
import CabCard from '@/components/CabCard'
import LogoutButton from '@/components/LogoutButton'
import AddPassengerModal from '@/components/AddPassengerModal'
import AddCabForm from '@/components/AddCabForm'
import ImportedBanner from '@/components/ImportedBanner'
import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import type { Passenger, Cab, Driver, CarType, PriceTier } from '@/lib/types'


export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  const { data: membership } = user
    ? await supabase.from('memberships').select('org_id').eq('user_id', user.id).limit(1).single()
    : { data: null }

  const [{ data: project }, { data: rows }, { data: cabRows }, { data: driverRows }, { data: org }, { data: carTypeRows }, { data: priceTierRows }] = await Promise.all([
    supabase.from('projects').select('name').eq('id', id).single(),
    supabase.from('passengers').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('cabs').select('*, drivers(id, name, phone), passengers(*)').eq('project_id', id).order('label'),
    membership
      ? supabase.from('drivers').select('id, name, phone').eq('org_id', membership.org_id).not('registered_at', 'is', null).order('name')
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; phone: string | null }> }),
    membership
      ? supabase.from('organisations').select('name').eq('id', membership.org_id).single()
      : Promise.resolve({ data: null }),
    membership
      ? supabase.from('car_types').select('id, name, max_capacity').eq('org_id', membership.org_id).order('max_capacity')
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; max_capacity: number }> }),
    membership
      ? supabase.from('price_tiers').select('id, min_pax, max_pax, price').eq('org_id', membership.org_id).order('min_pax')
      : Promise.resolve({ data: [] as Array<{ id: string; min_pax: number; max_pax: number; price: number }> }),
  ])

  // Build a map of cab status + metadata for passenger enrichment
  // Compute pax counts per cab from the cabs' nested passenger lists
  const cabPaxCounts = new Map<string, number>()
  for (const c of cabRows ?? []) {
    const nonDeleted = ((c.passengers as Array<{ is_deleted?: boolean }>) ?? []).filter(p => !p.is_deleted)
    cabPaxCounts.set(c.id as string, nonDeleted.length)
  }

  const carTypeMap = new Map<string, string>()
  for (const ct of carTypeRows ?? []) {
    carTypeMap.set(ct.id as string, ct.name as string)
  }

  type CabMeta = {
    color: string | null
    startedAt: string | null
    isDone: boolean
    doneBy: string | null
    driverName: string | null
    driverChangedBy: string | null
    number: number | null
    carTypeId: string | null
    carTypeName: string | null
    price: number | null
  }
  const cabStatusMap = new Map<string, CabMeta>()
  for (const c of cabRows ?? []) {
    const driver = c.drivers as { id: string; name: string; phone: string | null } | null
    const label = c.label as string
    const numMatch = label.match(/^Cab (\d+)$/)
    cabStatusMap.set(c.id as string, {
      color: c.color as string | null,
      startedAt: c.started_at as string | null,
      isDone: c.is_done as boolean,
      doneBy: c.done_by as string | null,
      driverName: driver?.name ?? null,
      driverChangedBy: c.driver_changed_by as string | null,
      number: numMatch ? parseInt(numMatch[1]) : null,
      carTypeId: c.car_type_id as string | null,
      carTypeName: c.car_type_id ? (carTypeMap.get(c.car_type_id as string) ?? null) : null,
      price: c.price as number | null,
    })
  }

  const mapPassenger = (r: Record<string, unknown>): Passenger => {
    const cabStatus = cabStatusMap.get(r.cab_id as string) ?? null
    return {
      id: r.id as string,
      name: r.name as string | null,
      phone: r.phone as string | null,
      flightNumber: r.flight_number as string | null,
      arrivalDate: r.arrival_date as string | null,
      arrivalTime: r.arrival_time as string | null,
      pickupTime: r.pickup_time as string | null,
      origin: r.origin as string | null,
      destination: r.destination as string | null,
      isDone: r.is_done as boolean,
      additionalDetails: r.additional_details as string | null,
      additionalDetailsUpdatedBy: r.additional_details_updated_by as string | null,
      cabId: r.cab_id as string | null,
      cabColor: cabStatus?.color ?? null,
      cabStartedAt: cabStatus?.startedAt ?? null,
      cabIsDone: cabStatus?.isDone ?? false,
      cabDoneBy: cabStatus?.doneBy ?? null,
      cabNumber: cabStatus?.number ?? null,
      cabDriverName: cabStatus?.driverName ?? null,
      cabDriverChangedBy: cabStatus?.driverChangedBy ?? null,
      cabPaxCount: cabStatus ? (cabPaxCounts.get(r.cab_id as string) ?? 0) : 0,
      cabCarTypeId: cabStatus?.carTypeId ?? null,
      cabCarTypeName: cabStatus?.carTypeName ?? null,
      cabPrice: cabStatus?.price ?? null,
      isDeleted: r.is_deleted as boolean ?? false,
      createdManually: r.created_manually as boolean ?? false,
      isEdited: (r.is_edited as boolean) ?? false,
      editedFields: (r.edited_fields as string[]) ?? [],
    }
  }

  // Sort so cab groups are contiguous (active rows before deleted within each group).
  // Passengers are ordered by sort_order from DB, but moving a passenger between cabs
  // doesn't update sort_order, so we re-group here before rendering.
  const cabMinSortOrder = new Map<string | null, number>()
  for (const r of rows ?? []) {
    const key = (r.cab_id as string | null) ?? null
    const so = (r.sort_order as number) ?? Infinity
    const cur = cabMinSortOrder.get(key)
    if (cur === undefined || so < cur) cabMinSortOrder.set(key, so)
  }
  const passengers: Passenger[] = [...(rows ?? [])]
    .sort((a, b) => {
      const aKey = (a.cab_id as string | null) ?? null
      const bKey = (b.cab_id as string | null) ?? null
      const aGroup = cabMinSortOrder.get(aKey) ?? Infinity
      const bGroup = cabMinSortOrder.get(bKey) ?? Infinity
      if (aGroup !== bGroup) return aGroup - bGroup
      // Active rows before deleted rows within the same cab
      const aD = (a.is_deleted as boolean) ? 1 : 0
      const bD = (b.is_deleted as boolean) ? 1 : 0
      if (aD !== bD) return aD - bD
      return ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
    })
    .map(r => mapPassenger(r as Record<string, unknown>))

  const cabs: Cab[] = (cabRows ?? []).map(c => {
    const driver = c.drivers as { id: string; name: string; phone: string | null } | null
    const allCabPassengers = ((c.passengers as unknown[]) ?? []).map(p => mapPassenger(p as Record<string, unknown>))
    const cabPassengers = allCabPassengers.filter(p => !p.isDeleted)
    return {
      id: c.id as string,
      label: c.label as string,
      driverId: c.driver_id as string | null,
      driverName: driver?.name ?? null,
      driverChangedBy: c.driver_changed_by as string | null,
      color: c.color as string | null,
      startedAt: c.started_at as string | null,
      isDone: c.is_done as boolean,
      carTypeId: c.car_type_id as string | null,
      carTypeName: c.car_type_id ? (carTypeMap.get(c.car_type_id as string) ?? null) : null,
      price: c.price as number | null,
      paxCount: cabPassengers.length,
      passengers: cabPassengers,
    }
  })

  const drivers: Driver[] = (driverRows ?? []).map(d => ({
    id: d.id as string,
    name: d.name as string,
    phone: d.phone as string | null,
  }))

  const carTypes: CarType[] = (carTypeRows ?? []).map(ct => ({
    id: ct.id as string,
    name: ct.name as string,
    maxCapacity: ct.max_capacity as number,
  }))

  // priceTierRows not passed to table (used only in bundleCabs), but kept for future use
  void (priceTierRows as PriceTier[] | null)

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <ImportedBanner />
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
            ← Dashboard
          </a>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            {org?.name && <p className="text-xs text-gray-400">{org.name}</p>}
            <h1 className="text-lg font-bold text-gray-900">{project?.name ?? 'Project'}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}
              {passengers.some(p => p.isDeleted) && (
                <span className="ml-1">
                  · {passengers.filter(p => !p.isDeleted).length} active, {passengers.filter(p => p.isDeleted).length} removed
                </span>
              )}
            </p>
          </div>
        </div>
        <LogoutButton />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden px-8 pt-6">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Passengers</h2>
            <div className="flex items-center gap-2">
              <a
                href={`/api/export/passengers/${id}`}
                className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 hover:text-gray-800 transition-colors"
              >
                ↓ Export .xlsx
              </a>
              {cabs.length > 0 && (
                <a
                  href={`/api/export/cab-pdfs/${id}`}
                  className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 hover:text-gray-800 transition-colors"
                >
                  ↓ All PDFs
                </a>
              )}
              <a
                href={`/project/${id}/upload`}
                className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 hover:text-gray-800 transition-colors"
              >
                ↑ Reimport chat
              </a>
              <AddPassengerModal projectId={id} cabs={cabs} />
            </div>
          </div>
          <div className="flex-1 overflow-auto pb-6">
            {passengers.length === 0 ? (
              <p className="text-sm text-gray-400">No passengers yet — upload a chat export to get started.</p>
            ) : (
              <PassengerTable passengers={passengers} drivers={drivers} carTypes={carTypes} cabs={cabs} />
            )}
          </div>
        </main>

        <aside className="w-80 border-l border-gray-100 bg-white overflow-auto px-6 py-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Cabs</h2>
          <div className="space-y-3">
            {cabs.length === 0
              ? <p className="text-sm text-gray-400">No cabs yet.</p>
              : [...cabs].sort((a, b) => Number(a.isDone) - Number(b.isDone))
                  .map(cab => <CabCard key={cab.id} cab={cab} allCabs={cabs} drivers={drivers} />)
            }
            <AddCabForm projectId={id} cabCount={cabs.length} />
          </div>
        </aside>
      </div>
    </div>
  )
}
