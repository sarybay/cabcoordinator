'use server'

import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createProject(name: string) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/auth/login')

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, org_id: membership?.org_id ?? null })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create project')

  redirect(`/project/${data.id}/upload`)
}

export async function setCabStatus(cabId: string, status: 'pending' | 'in_progress' | 'done'): Promise<{ doneBy: string | null }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()

  let doneBy: string | null = null
  if (status === 'done' && user) {
    const { data: driver } = await supabase
      .from('drivers').select('name').eq('user_id', user.id)
      .order('created_at', { ascending: true }).limit(1).single()
    doneBy = driver?.name ?? user.email ?? null
  }

  const updates =
    status === 'done'
      ? { is_done: true, started_at: new Date().toISOString(), done_by: doneBy }
      : status === 'in_progress'
      ? { started_at: new Date().toISOString(), is_done: false, done_by: null }
      : { started_at: null as unknown as string, is_done: false, done_by: null }

  const { error } = await supabase.from('cabs').update(updates).eq('id', cabId)
  if (error) throw new Error(error.message)
  // Mark all non-deleted passengers in this cab as edited (status change is a manual action)
  await supabase.from('passengers').update({ is_edited: true }).eq('cab_id', cabId).eq('is_deleted', false)
  revalidatePath('/project/[id]', 'page')
  revalidatePath('/dashboard')
  return { doneBy }
}

export async function markCabDone(cabId: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('cabs')
    .update({ is_done: true })
    .eq('id', cabId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
  revalidatePath('/dashboard')
}

export async function markCabStarted(cabId: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('cabs')
    .update({ started_at: new Date().toISOString() })
    .eq('id', cabId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
  revalidatePath('/dashboard')
}

export async function movePassenger(passengerId: string, toCabId: string) {
  const supabase = createServerClient()

  // Find the max sort_order among passengers already in the target cab
  const { data: existing } = await supabase
    .from('passengers')
    .select('sort_order')
    .eq('cab_id', toCabId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.sort_order ?? 0) + 1

  const { error } = await supabase
    .from('passengers')
    .update({ cab_id: toCabId, sort_order: nextOrder })
    .eq('id', passengerId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
}

export async function assignDriverToCab(cabId: string, driverId: string | null) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()
  let changedBy: string | null = null
  if (user) {
    const { data: driver } = await supabase
      .from('drivers').select('name').eq('user_id', user.id)
      .order('created_at', { ascending: true }).limit(1).single()
    changedBy = driver?.name ?? user.email ?? null
  }
  const { error } = await supabase
    .from('cabs')
    .update({ driver_id: driverId, driver_changed_by: changedBy })
    .eq('id', cabId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
}

export async function updateCabCarType(cabId: string, carTypeId: string | null) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('cabs').update({ car_type_id: carTypeId }).eq('id', cabId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
}

export async function updateCabPrice(cabId: string, price: number | null) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('cabs').update({ price }).eq('id', cabId)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
}

export async function updateOrgPaxSettings(min: number, max: number): Promise<{ error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships').select('org_id').eq('user_id', user.id).eq('role', 'owner').limit(1).single()
  if (!membership) return { error: 'Not an admin' }

  const { error } = await supabase
    .from('organisations').update({ min_pax: min, max_pax: max }).eq('id', membership.org_id)
  if (error) return { error: error.message }
  revalidatePath('/account')
  return {}
}

export async function createCarType(name: string, maxCapacity: number): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Name is required' }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships').select('org_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { error: 'No organisation found' }

  const { error } = await supabase
    .from('car_types').insert({ org_id: membership.org_id, name: name.trim(), max_capacity: maxCapacity })
  if (error) return { error: error.message }
  revalidatePath('/account')
  return {}
}

export async function deleteCarType(id: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('car_types').delete().eq('id', id)
  revalidatePath('/account')
}

export async function createPriceTier(minPax: number, maxPax: number, price: number): Promise<{ error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships').select('org_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { error: 'No organisation found' }

  const { error } = await supabase
    .from('price_tiers').insert({ org_id: membership.org_id, min_pax: minPax, max_pax: maxPax, price })
  if (error) return { error: error.message }
  revalidatePath('/account')
  return {}
}

export async function deletePriceTier(id: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('price_tiers').delete().eq('id', id)
  revalidatePath('/account')
}

export async function updatePassengerDetails(id: string, details: string): Promise<{ error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: driver } = await supabase
    .from('drivers').select('name').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).single()
  const updatedBy = driver?.name ?? user.email ?? 'Unknown'

  const { data: current } = await supabase.from('passengers').select('edited_fields').eq('id', id).single()
  const currentFields = (current?.edited_fields as string[]) ?? []
  const newFields = Array.from(new Set([...currentFields, 'details']))

  const { error } = await supabase
    .from('passengers')
    .update({
      additional_details: details.trim() || null,
      additional_details_updated_by: details.trim() ? updatedBy : null,
      is_edited: true,
      edited_fields: newFields,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/project/[id]', 'page')
  return {}
}

export async function togglePassengerDone(id: string, isDone: boolean) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('passengers')
    .update({ is_done: isDone })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/project/[id]', 'page')
}

export async function updateProfileAction(name: string, phone: string): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Name is required' }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('drivers')
    .update({ name: name.trim(), phone: phone.trim() || null })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/account')
  return {}
}

export async function updateOrgNameAction(name: string): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Name is required' }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships').select('org_id').eq('user_id', user.id).eq('role', 'owner').limit(1).single()
  if (!membership) return { error: 'Not an admin' }

  const { error } = await supabase
    .from('organisations').update({ name: name.trim() }).eq('id', membership.org_id)

  if (error) return { error: error.message }
  revalidatePath('/account')
  revalidatePath('/(app)/layout', 'layout')
  return {}
}

export async function updateCoordinatorPhone(phone: string): Promise<{ error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships').select('org_id').eq('user_id', user.id).eq('role', 'owner').limit(1).single()
  if (!membership) return { error: 'Not an admin' }

  const value = phone.trim() || null
  const { error } = await supabase
    .from('organisations').update({ coordinator_phone: value }).eq('id', membership.org_id)

  if (error) return { error: error.message }
  revalidatePath('/account')
  return {}
}

export async function createDriverInviteAction(email: string): Promise<{ inviteLink: string } | { error: string }> {
  if (!email.trim()) return { error: 'Email is required' }

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = createServerClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No organisation found' }

  const { data: existing } = await supabase
    .from('drivers')
    .select('invite_token')
    .eq('org_id', membership.org_id)
    .eq('email', email.trim())
    .is('registered_at', null)
    .maybeSingle()

  let inviteToken: string

  if (existing) {
    inviteToken = existing.invite_token as string
  } else {
    const { data, error } = await supabase
      .from('drivers')
      .insert({ org_id: membership.org_id, name: 'Invited driver', email: email.trim() })
      .select('invite_token')
      .single()
    if (error || !data) return { error: error?.message ?? 'Failed to create invite' }
    inviteToken = data.invite_token as string
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // Use admin.generateLink (service role, implicit flow — no PKCE cookie needed on the driver's browser)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email.trim(),
    options: { redirectTo: `${siteUrl}/auth/confirm?next=/invite/${inviteToken}` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return { error: linkError?.message ?? 'Failed to generate invite link' }
  }

  return { inviteLink: linkData.properties.action_link }
}

export async function deletePassenger(id: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('passengers').update({ is_deleted: true }).eq('id', id)
  revalidatePath('/project/[id]', 'page')
}

export async function restorePassenger(id: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('passengers').update({ is_deleted: false }).eq('id', id)
  revalidatePath('/project/[id]', 'page')
}

export async function addPassenger(
  projectId: string,
  data: {
    name?: string; phone?: string; flightNumber?: string
    arrivalDate?: string; arrivalTime?: string
    origin?: string; destination?: string
    additionalDetails?: string; cabId?: string | null
  }
): Promise<{ error?: string }> {
  const supabase = createServerClient()

  // Always use global project max so the new passenger lands at the bottom
  const { data: existing } = await supabase
    .from('passengers').select('sort_order').eq('project_id', projectId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sortOrder = (existing?.sort_order ?? 0) + 1

  const { error } = await supabase.from('passengers').insert({
    project_id: projectId,
    name: data.name?.trim() || null,
    phone: data.phone?.trim() || null,
    flight_number: data.flightNumber?.trim() || null,
    arrival_date: data.arrivalDate || null,
    arrival_time: data.arrivalTime || null,
    origin: data.origin?.trim() || null,
    destination: data.destination?.trim() || null,
    additional_details: data.additionalDetails?.trim() || null,
    cab_id: data.cabId ?? null,
    sort_order: sortOrder,
    is_done: false,
    is_deleted: false,
    created_manually: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/project/[id]', 'page')
  return {}
}

export async function updatePassengerField(
  id: string,
  field: 'name' | 'phone' | 'flight_number' | 'arrival_date' | 'arrival_time' | 'pickup_time' | 'origin' | 'destination',
  value: string | null
): Promise<{ error?: string }> {
  const supabase = createServerClient()
  const { data: current } = await supabase.from('passengers').select('edited_fields').eq('id', id).single()
  const currentFields = (current?.edited_fields as string[]) ?? []
  const newFields = Array.from(new Set([...currentFields, field]))
  const { error } = await supabase
    .from('passengers')
    .update({ [field]: value, is_edited: true, edited_fields: newFields })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/project/[id]', 'page')
  return {}
}

export async function addCab(projectId: string, label: string): Promise<{ id: string } | { error: string }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('cabs')
    .insert({ project_id: projectId, label: label.trim() })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create cab' }
  revalidatePath('/project/[id]', 'page')
  return { id: data.id as string }
}
