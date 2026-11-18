import type { SupabaseClient } from '@supabase/supabase-js'

export const CAB_WINDOW_MINUTES = 30
export const CAB_MAX_PASSENGERS = 5

const CAB_COLORS = ['blue', 'green', 'orange', 'purple', 'rose', 'teal', 'amber', 'pink']

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function routeKey(origin: string | null, destination: string | null): string | null {
  if (!origin?.trim() || !destination?.trim()) return null
  return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`
}

export async function bundlePassengersIntoCabs(
  projectId: string,
  supabase: SupabaseClient,
  orgId?: string
) {
  const { data: passengers, error } = await supabase
    .from('passengers')
    .select('id, arrival_date, arrival_time, origin, destination')
    .eq('project_id', projectId)

  if (error || !passengers?.length) return

  // Fetch org settings and catalogue (car types, price tiers) if orgId provided
  let maxPax = CAB_MAX_PASSENGERS
  let carTypes: Array<{ id: string; max_capacity: number }> = []
  let priceTiers: Array<{ min_pax: number; max_pax: number; price: number }> = []

  if (orgId) {
    const [orgRes, carRes, priceRes] = await Promise.all([
      supabase.from('organisations').select('max_pax').eq('id', orgId).single(),
      supabase.from('car_types').select('id, max_capacity').eq('org_id', orgId).order('max_capacity'),
      supabase.from('price_tiers').select('min_pax, max_pax, price').eq('org_id', orgId).order('min_pax'),
    ])
    if (orgRes.data?.max_pax) maxPax = orgRes.data.max_pax
    carTypes = carRes.data ?? []
    priceTiers = priceRes.data ?? []
  }

  // Clear existing cabs (ON DELETE SET NULL clears passengers.cab_id)
  await supabase.from('cabs').delete().eq('project_id', projectId)

  // Split into passengers with/without arrival time
  const withTime = passengers.filter(p => p.arrival_time)
  const noTime = passengers.filter(p => !p.arrival_time)

  // Group by arrival_date, sort by time within each day
  const byDate: Record<string, typeof withTime> = {}
  for (const p of withTime) {
    const key = p.arrival_date ?? 'unknown'
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(p)
  }

  let cabIndex = 0
  const cabAssignments: Array<{ cabId: string; passengerIds: string[] }> = []

  function pickCarType(paxCount: number): string | null {
    return carTypes.find(ct => ct.max_capacity >= paxCount)?.id ?? null
  }

  function pickPrice(paxCount: number): number | null {
    return priceTiers.find(pt => paxCount >= pt.min_pax && paxCount <= pt.max_pax)?.price ?? null
  }

  for (const date of Object.keys(byDate).sort()) {
    const sorted = byDate[date].sort(
      (a, b) => toMinutes(a.arrival_time) - toMinutes(b.arrival_time)
    )

    let group: typeof sorted = []
    let groupRoute: string | null = null
    for (const p of sorted) {
      if (group.length === 0) {
        group.push(p)
        groupRoute = routeKey(p.origin, p.destination)
        continue
      }
      const pRoute = routeKey(p.origin, p.destination)
      const gap = toMinutes(p.arrival_time) - toMinutes(group[0].arrival_time)
      const full = group.length >= maxPax
      const routeOk = !pRoute || !groupRoute || pRoute === groupRoute
      if (!full && gap <= CAB_WINDOW_MINUTES && routeOk) {
        group.push(p)
        if (!groupRoute && pRoute) groupRoute = pRoute
      } else {
        const color = CAB_COLORS[cabIndex % CAB_COLORS.length]
        const n = group.length
        const { data: cab } = await supabase
          .from('cabs')
          .insert({
            project_id: projectId,
            label: `Cab ${cabIndex + 1}`,
            color,
            car_type_id: pickCarType(n),
            price: pickPrice(n),
          })
          .select('id').single()
        if (cab) cabAssignments.push({ cabId: cab.id, passengerIds: group.map(g => g.id) })
        cabIndex++
        group = [p]
        groupRoute = pRoute
      }
    }
    if (group.length > 0) {
      const color = CAB_COLORS[cabIndex % CAB_COLORS.length]
      const n = group.length
      const { data: cab } = await supabase
        .from('cabs')
        .insert({
          project_id: projectId,
          label: `Cab ${cabIndex + 1}`,
          color,
          car_type_id: pickCarType(n),
          price: pickPrice(n),
        })
        .select('id').single()
      if (cab) cabAssignments.push({ cabId: cab.id, passengerIds: group.map(g => g.id) })
      cabIndex++
    }
  }

  // Passengers with no arrival time → their own cab
  if (noTime.length > 0) {
    const color = CAB_COLORS[cabIndex % CAB_COLORS.length]
    const n = noTime.length
    const { data: cab } = await supabase
      .from('cabs')
      .insert({
        project_id: projectId,
        label: 'Cab — Time Unknown',
        color,
        car_type_id: pickCarType(n),
        price: pickPrice(n),
      })
      .select('id').single()
    if (cab) cabAssignments.push({ cabId: cab.id, passengerIds: noTime.map(p => p.id) })
    cabIndex++
  }

  // Assign cab_id to each passenger
  for (const { cabId, passengerIds } of cabAssignments) {
    await supabase.from('passengers').update({ cab_id: cabId }).in('id', passengerIds)
  }
}
