-- 008_rls_scoped.sql
-- Replace open "using (true)" RLS policies with org-scoped policies.
-- Service role (used by all server-side code) bypasses RLS entirely.
-- Only direct anon-key queries are restricted.

-- Helper: set of org_ids the current auth user belongs to
create or replace function auth_user_org_ids()
returns setof uuid language sql security definer stable as $$
  select org_id from public.memberships where user_id = auth.uid()
$$;

-- ── organisations ──────────────────────────────────────────────────────────
drop policy if exists "read organisations" on public.organisations;
drop policy if exists "insert organisations" on public.organisations;
drop policy if exists "update organisations" on public.organisations;
drop policy if exists "delete organisations" on public.organisations;

create policy "members read org" on public.organisations
  for select using (id in (select auth_user_org_ids()));

create policy "owners update org" on public.organisations
  for update using (id in (
    select org_id from public.memberships
    where user_id = auth.uid() and role = 'owner'
  ));

-- ── memberships ────────────────────────────────────────────────────────────
drop policy if exists "read memberships" on public.memberships;
drop policy if exists "insert memberships" on public.memberships;
drop policy if exists "update memberships" on public.memberships;
drop policy if exists "delete memberships" on public.memberships;

create policy "read own memberships" on public.memberships
  for select using (user_id = auth.uid());

-- ── drivers ────────────────────────────────────────────────────────────────
drop policy if exists "read drivers" on public.drivers;
drop policy if exists "insert drivers" on public.drivers;
drop policy if exists "update drivers" on public.drivers;
drop policy if exists "delete drivers" on public.drivers;

create policy "members read drivers" on public.drivers
  for select using (org_id in (select auth_user_org_ids()));

-- ── projects ───────────────────────────────────────────────────────────────
drop policy if exists "read projects" on public.projects;
drop policy if exists "insert projects" on public.projects;
drop policy if exists "update projects" on public.projects;
drop policy if exists "delete projects" on public.projects;

create policy "members read projects" on public.projects
  for select using (org_id in (select auth_user_org_ids()));
create policy "members insert projects" on public.projects
  for insert with check (org_id in (select auth_user_org_ids()));
create policy "members update projects" on public.projects
  for update using (org_id in (select auth_user_org_ids()));

-- ── passengers ─────────────────────────────────────────────────────────────
drop policy if exists "read passengers" on public.passengers;
drop policy if exists "insert passengers" on public.passengers;
drop policy if exists "update passengers" on public.passengers;
drop policy if exists "delete passengers" on public.passengers;

create policy "members read passengers" on public.passengers
  for select using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members insert passengers" on public.passengers
  for insert with check (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members update passengers" on public.passengers
  for update using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members delete passengers" on public.passengers
  for delete using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );

-- ── cabs ───────────────────────────────────────────────────────────────────
drop policy if exists "read cabs" on public.cabs;
drop policy if exists "insert cabs" on public.cabs;
drop policy if exists "update cabs" on public.cabs;
drop policy if exists "delete cabs" on public.cabs;

create policy "members read cabs" on public.cabs
  for select using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members insert cabs" on public.cabs
  for insert with check (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members update cabs" on public.cabs
  for update using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );
create policy "members delete cabs" on public.cabs
  for delete using (
    project_id in (
      select id from public.projects where org_id in (select auth_user_org_ids())
    )
  );

-- ── car_types ──────────────────────────────────────────────────────────────
drop policy if exists "read car_types" on public.car_types;
drop policy if exists "insert car_types" on public.car_types;
drop policy if exists "update car_types" on public.car_types;
drop policy if exists "delete car_types" on public.car_types;

create policy "members read car_types" on public.car_types
  for select using (org_id in (select auth_user_org_ids()));
create policy "owners write car_types" on public.car_types
  for all using (
    org_id in (
      select org_id from public.memberships
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ── price_tiers ────────────────────────────────────────────────────────────
drop policy if exists "read price_tiers" on public.price_tiers;
drop policy if exists "insert price_tiers" on public.price_tiers;
drop policy if exists "update price_tiers" on public.price_tiers;
drop policy if exists "delete price_tiers" on public.price_tiers;

create policy "members read price_tiers" on public.price_tiers
  for select using (org_id in (select auth_user_org_ids()));
create policy "owners write price_tiers" on public.price_tiers
  for all using (
    org_id in (
      select org_id from public.memberships
      where user_id = auth.uid() and role = 'owner'
    )
  );
