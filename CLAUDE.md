# WhatsApp Cab Coordinator — App Rulebook

> **Who:** Event organisers / taxi admins who collect attendee travel details in WhatsApp group chats.
> **One job:** Upload a WhatsApp chat export → extract passenger travel details into a table → bundle arrivals into cabs → assign cabs to drivers → mark deliveries done.
> **Done means:** A stranger can do this in a browser in under 2 minutes without help.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Database + Storage | Supabase — EU Frankfurt region (`eu-central-1`) |
| Deployment | Vercel |
| AI parsing | Claude Haiku 5.5 (`claude-haiku-5-5`) via Anthropic API |
| AI route | `/api/parse-chat` — server-side only, never called from the browser |
| Flight status route | `/api/flight-status` — server-side only, provider-swappable |

---

## Rules

1. **Desktop-first full-screen web.** Design for a full-browser viewport (1280 px+). No mobile layout required.
2. **One change per step.** Each build step produces one testable thing. Do not combine steps.
3. **Secrets stay in `.env.local`.** Never hard-code keys in source files. Never commit `.env.local`.
4. **AI is server-side only.** The Anthropic SDK is called exclusively inside `/api/parse-chat`. No AI imports in components or client code.
5. **Supabase RLS is ON.** Every table needs explicit Row Level Security policies before the feature works.
6. **Delete uploaded files immediately after parsing.** Chat exports are deleted from Supabase Storage in the same API route that processes them.
7. **Use fake data in development.** Seed scripts and fixtures use invented names, numbers, and flight codes. Never paste real passenger data.
8. **Flight-status provider is swappable.** All flight API calls live inside `/api/flight-status`. Callers never import a flight SDK directly.

---

## Environment Variables

```
# .env.local — never commit this file
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
FLIGHT_API_KEY=          # post-MVP
FLIGHT_API_BASE_URL=     # post-MVP
```

---

## Database Schema

### Migration order: 001 cabs → 002 projects → 003 passengers → 004 rls
(cabs must exist before passengers because passengers.cab_id references cabs.id)

```sql
-- 001_create_cabs.sql
create table cabs (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null,
  label                 text not null,
  driver_name           text,
  driver_phone          text,
  estimated_pickup_time timestamptz,
  is_done               boolean not null default false,
  created_at            timestamptz not null default now()
);

-- 002_create_projects.sql
create table projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  created_at        timestamptz not null default now(),
  last_updated_at   timestamptz not null default now(),
  last_message_date date
);

-- 003_create_passengers.sql
create table passengers (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  name            text,
  phone           text,
  flight_number   text,
  arrival_date    date,
  arrival_time    time,
  departure_date  date,
  departure_time  time,
  raw_text        text,
  is_done         boolean not null default false,
  cab_id          uuid references cabs(id) on delete set null,
  sort_order      integer,
  created_at      timestamptz not null default now()
);

-- 004_rls_policies.sql  (MVP: open policies; tighten in auth step)
alter table projects   enable row level security;
alter table cabs       enable row level security;
alter table passengers enable row level security;

create policy "read projects"   on projects for select using (true);
create policy "insert projects" on projects for insert with check (true);
create policy "update projects" on projects for update using (true);

create policy "read cabs"   on cabs for select using (true);
create policy "insert cabs" on cabs for insert with check (true);
create policy "update cabs" on cabs for update using (true);
create policy "delete cabs" on cabs for delete using (true);

create policy "read passengers"   on passengers for select using (true);
create policy "insert passengers" on passengers for insert with check (true);
create policy "update passengers" on passengers for update using (true);
create policy "delete passengers" on passengers for delete using (true);
```

---

## AI Parsing Contract

`POST /api/parse-chat` — body: `{ projectId, filePath }`

Steps inside the route:
1. Download file from Supabase Storage (service-role key).
2. Send text to Claude Haiku 5.5 with this system prompt:
   > "You are a data-extraction assistant. The user will give you a WhatsApp group chat export.
   > Extract every person who shared travel information. For each person return a JSON array of objects
   > with these exact keys: name, phone, flight_number, arrival_date (YYYY-MM-DD or null),
   > arrival_time (HH:MM or null), departure_date (YYYY-MM-DD or null), departure_time (HH:MM or null), raw_text.
   > raw_text is the original message(s) mentioning this person.
   > If a field is not present, use null. Return ONLY the JSON array, no prose."
3. Parse the JSON → bulk-insert into `passengers`.
4. Call `bundlePassengersIntoCabs(projectId, supabase)`.
5. Delete the file from Storage.
6. Return `{ count }`.

---

## Cab Auto-Bundling Logic (`/lib/bundleCabs.ts`)

- Group passengers by `arrival_date`.
- Within each day, sort by `arrival_time`.
- Passengers whose `arrival_time` values are within **30 minutes** (`CAB_WINDOW_MINUTES = 30`) of each other → same cab.
- Create one `cabs` row per group, labelled `Cab 1`, `Cab 2`, etc.
- Passengers with null `arrival_time` → `Cab — Time Unknown`.

---

## Project File Map

```
/app
  page.tsx                        — landing: create project
  /project/[id]/page.tsx          — boss view: table + cabs
  /project/[id]/upload/page.tsx   — upload screen
  /driver/[cabId]/page.tsx        — driver view
/api
  /parse-chat/route.ts            — AI parsing (server only)
  /flight-status/route.ts         — flight proxy (post-MVP)
/lib
  supabase.ts                     — browser Supabase client
  supabaseServer.ts               — server Supabase client (service role)
  bundleCabs.ts                   — cab grouping logic
  types.ts                        — shared TypeScript interfaces
/components
  PassengerTable.tsx
  CabCard.tsx
  UploadDropzone.tsx
  MarkDoneButton.tsx
/supabase/migrations/
  001_create_cabs.sql
  002_create_projects.sql
  003_create_passengers.sql
  004_rls_policies.sql
  seed.sql                        — fake data only
```

---

## Build Plan

### MVP Steps (Steps 1–13)

**Step 1 — Scaffold the Next.js project**
- Run: `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir no --import-alias "@/*"`
- Create `.env.local` with all variable names as empty placeholders.
- Confirm `.env.local` is in `.gitignore`.
- **Test:** `npm run dev` → open `http://localhost:3000` → default Next.js page, no terminal errors.

**Step 2 — Connect Supabase**
- In Supabase dashboard: create project in `eu-central-1`.
- Fill in `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Create `lib/supabase.ts` (browser client) and `lib/supabaseServer.ts` (service-role server client).
- Install: `npm install @supabase/ssr @supabase/supabase-js`.
- **Test:** Temporary `console.log` in a Server Component calls `select('count')` on `projects` → prints `{ count: 0 }`, no error. Remove the log.

**Step 3 — Run database migrations**
- Create the four SQL files under `supabase/migrations/` from the schema section above.
- Run each in order in the Supabase SQL editor.
- **Test:** Supabase Table Editor shows `projects`, `cabs`, `passengers`. Running `insert into projects (name) values ('Test');` succeeds.

**Step 4 — Create-project landing page**
- `app/page.tsx` — centered full-screen form: project name input + "Create project" button.
- On submit: insert row into `projects`, redirect to `/project/[id]/upload`.
- `lib/types.ts` — `Project`, `Passenger`, `Cab` TypeScript interfaces.
- **Test:** Open in browser, type a name, click button → land on `/project/[id]/upload`. Row visible in Supabase Table Editor.

**Step 5 — Upload screen and file storage**
- `app/project/[id]/upload/page.tsx` — file input (`.txt`), "Parse chat" button, loading state.
- `components/UploadDropzone.tsx` — file input component (also drag-and-drop on desktop).
- Supabase Storage: create private bucket `chat-exports`. Bucket policy: anon can insert, only service role can read.
- On file select: upload to `chat-exports/{projectId}/{timestamp}.txt`, then POST to `/api/parse-chat`.
- **Test:** Pick a `.txt` file → click "Parse chat" → spinner appears → file visible in Supabase Storage.

**Step 6 — AI parsing route**
- `api/parse-chat/route.ts` — download file → call Claude Haiku 5.5 → parse JSON → bulk-insert passengers → delete file → return `{ count }`.
- Install: `npm install @anthropic-ai/sdk`.
- Fill in `ANTHROPIC_API_KEY` in `.env.local`.
- **Test with fake data:**
  ```
  [12/06/2024, 08:14] Sam: Hi! Flying in BA442, arriving 14 June 16:30. 07700900001.
  [12/06/2024, 08:22] Priya: EZY8801 landing 14 June 17:05. +447700900002
  [12/06/2024, 09:01] Marcus: Coming 15 June BA109 arrives 09:50, 07700900003
  ```
  Upload → spinner → Supabase `passengers` shows 3 rows → file gone from Storage.

**Step 7 — Passenger table view**
- `app/project/[id]/page.tsx` — Server Component fetches passengers, renders `<PassengerTable>`.
- `components/PassengerTable.tsx` — horizontally scrollable table. Columns: Name, Phone, Flight, Arrival date, Arrival time, Status.
- Upload screen redirects here after parsing.
- **Test:** After Step 6, land on `/project/[id]` → table with 3 rows visible.

**Step 8 — Mark passenger as done**
- `components/MarkDoneButton.tsx` — toggle. On change: Server Action sets `passengers.is_done`.
- **Test:** Click toggle → Supabase shows `is_done = true`. Click again → reverts.

**Step 9 — Auto-bundle passengers into cabs**
- `lib/bundleCabs.ts` — `bundlePassengersIntoCabs(projectId, supabase)` per the logic above.
- `api/parse-chat/route.ts` — call bundling after inserting passengers.
- `components/CabCard.tsx` — cab label, passenger list, arrival window, driver name (empty).
- `app/project/[id]/page.tsx` — "Cabs" section below the table.
- **Test:** Sam + Priya (35 min apart, same day) → 1 cab. Marcus (different day) → separate cab. Two CabCards visible.

**Step 10 — Assign cab to driver**
- `components/CabCard.tsx` — editable driver name + phone fields. On blur: Server Action updates `cabs.driver_name` / `cabs.driver_phone`.
- **Test:** Type an invented driver name → click away → Supabase shows updated value. Refresh → still there.

**Step 11 — Move passengers between cabs**
- `components/CabCard.tsx` — each passenger gets a "Move" button → bottom sheet listing other cabs.
- Selecting a cab: Server Action updates `passengers.cab_id`. Page revalidates.
- **Test:** Move a passenger from Cab 1 to Cab 2 → Cab 1 loses the row, Cab 2 gains it. Supabase confirms `cab_id` changed.

**Step 12 — Driver view**
- `app/driver/[cabId]/page.tsx` — shows: cab label, driver name, passenger list (name, flight, arrival time), large "Mark drive done" button.
- URL is the driver's access token for MVP (no auth).
- **Test:** Open `/driver/[cabId]` in a private window → only that cab's passengers visible.

**Step 13 — Driver marks drive as done**
- Wire button → Server Action sets `cabs.is_done = true`.
- `components/CabCard.tsx` — green "Driver done" badge when `cabs.is_done = true`.
- **Test:** Click button on driver view → confirmed state. Boss view refresh → green badge on CabCard.

**MVP complete.**

---

### Post-MVP Steps (later, not now)

**Step 14 — Authentication and organisations**
- Supabase Auth (email). Tables: `organisations`, `memberships`.
- Login/signup pages, `middleware.ts` protecting `/project/*`.
- Rewrite all RLS policies scoped to `auth.uid()` and org membership.
- Invite-driver flow via magic link.

**Step 15 — Screenshot and video upload**
- Extend `UploadDropzone` to accept `image/*` and `video/*`.
- Images → Claude vision. Video → extract frames with `ffmpeg-static` → Claude vision per frame.

**Step 16 — Live flight status**
- `api/flight-status/route.ts` — proxy to flight API.
- `PassengerTable` — "Flight status" column, auto-refreshes every 30 min.
- `CabCard` — yellow "Delay" badge if any passenger is delayed > 20 min.

**Step 17 — PDF export per cab**
- `@react-pdf/renderer` + `lib/cabPdf.tsx`.
- `api/export/cab-pdf/route.ts` returns a PDF stream.
- CabCard → "Download PDF" button.

**Step 18 — Excel / CSV export**
- `xlsx` (SheetJS) for `.xlsx`. Plain-text route for CSV.
- Boss view → "Export Excel" and "Export CSV" buttons.

**Step 19 — Design polish**
- Brand colours, Inter font, consistent spacing, skeleton loaders.
- All columns visible without horizontal scroll at 1280 px+.
