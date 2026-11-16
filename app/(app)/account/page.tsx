import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import InviteDriverButton from '@/components/InviteDriverButton'
import ProfileForm from '@/components/ProfileForm'
import OrgNameForm from '@/components/OrgNameForm'
import CoordinatorPhoneForm from '@/components/CoordinatorPhoneForm'
import OrgPaxSettingsForm from '@/components/OrgPaxSettingsForm'
import CarTypesManager from '@/components/CarTypesManager'
import PriceTiersManager from '@/components/PriceTiersManager'
import type { CarType, PriceTier } from '@/lib/types'

export default async function AccountPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const supabase = createServerClient()

  // Find the current user's driver record — it always has the correct org_id
  const { data: myDriver } = user
    ? await supabase.from('drivers').select('id, name, phone, email, org_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).single()
    : { data: null }

  // Fetch the org (include pax settings columns)
  const { data: org } = myDriver
    ? await supabase.from('organisations').select('id, name, min_pax, max_pax, coordinator_phone').eq('id', myDriver.org_id).single()
    : { data: null }

  // Fetch all drivers in the same org
  const { data: drivers } = myDriver
    ? await supabase
        .from('drivers')
        .select('id, name, phone, email, user_id, registered_at')
        .eq('org_id', myDriver.org_id)
        .order('registered_at', { ascending: false })
    : { data: [] }

  // Fetch cab settings data (car types, price tiers, org pax limits)
  const [{ data: carTypeRows }, { data: priceTierRows }] = myDriver ? await Promise.all([
    supabase.from('car_types').select('id, name, max_capacity').eq('org_id', myDriver.org_id).order('max_capacity'),
    supabase.from('price_tiers').select('id, min_pax, max_pax, price').eq('org_id', myDriver.org_id).order('min_pax'),
  ]) : [{ data: [] }, { data: [] }]

  const carTypes: CarType[] = (carTypeRows ?? []).map(ct => ({
    id: ct.id as string,
    name: ct.name as string,
    maxCapacity: ct.max_capacity as number,
  }))
  const priceTiers: PriceTier[] = (priceTierRows ?? []).map(pt => ({
    id: pt.id as string,
    minPax: pt.min_pax as number,
    maxPax: pt.max_pax as number,
    price: Number(pt.price),
  }))

  // Find the org owner(s) to mark as Admin
  const { data: ownerMemberships } = myDriver
    ? await supabase.from('memberships').select('user_id').eq('org_id', myDriver.org_id).eq('role', 'owner')
    : { data: [] }
  const ownerIds = new Set((ownerMemberships ?? []).map((m: { user_id: string }) => m.user_id))
  const isAdmin = !!(user && ownerIds.has(user.id))

  const active = (drivers ?? []).filter(d => d.registered_at)
  const pending = (drivers ?? []).filter(d => !d.registered_at)

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-lg font-bold text-gray-900 mb-6">Account</h1>

      {/* Organisation */}
      {org && (
        <section className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Organisation</h2>
          {isAdmin ? (
            <>
              <OrgNameForm currentName={org.name} />
              <div className="mt-3 pt-3 border-t border-gray-50">
                <CoordinatorPhoneForm initialPhone={(org as { coordinator_phone?: string | null }).coordinator_phone ?? null} />
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Organisation name</p>
              <p className="text-sm font-medium text-gray-900">{org.name}</p>
            </div>
          )}
        </section>
      )}

      {/* Cab settings — admin only */}
      {isAdmin && (
        <section className="bg-white rounded-xl border border-gray-100 p-6 mb-4 space-y-6">
          <h2 className="text-sm font-semibold text-gray-700">Cab settings</h2>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pax per cab</p>
            <OrgPaxSettingsForm
              initialMin={(org as { min_pax?: number } | null)?.min_pax ?? 1}
              initialMax={(org as { max_pax?: number } | null)?.max_pax ?? 5}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Car types</p>
            <CarTypesManager initialCarTypes={carTypes} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Price tiers</p>
            <PriceTiersManager initialPriceTiers={priceTiers} />
          </div>
        </section>
      )}

      {/* Drivers */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Drivers</h2>
          {isAdmin && <InviteDriverButton />}
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-gray-400">No drivers yet. Send an invite link to get started.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {active.map(d => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {d.name}
                    {d.user_id && ownerIds.has(d.user_id) && (
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(Admin)</span>
                    )}
                  </p>
                  {d.phone && <p className="text-xs text-gray-400 mt-0.5">{d.phone}</p>}
                  {d.email && <p className="text-xs text-gray-400 mt-0.5">{d.email}</p>}
                </div>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pending invites</p>
            <ul className="space-y-1">
              {pending.map(d => (
                <li key={d.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-500">{d.email ?? 'Unknown email'}</span>
                  <span className="text-xs text-amber-600 font-medium">Pending</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Profile</h2>
        {myDriver ? (
          <ProfileForm
            currentName={myDriver.name}
            currentPhone={myDriver.phone ?? null}
            email={myDriver.email ?? user?.email ?? ''}
          />
        ) : (
          <p className="text-sm text-gray-400">{user?.email}</p>
        )}
      </section>
    </div>
  )
}
