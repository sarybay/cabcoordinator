import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabaseServer'
import { bundlePassengersIntoCabs } from '@/lib/bundleCabs'

export const maxDuration = 60

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a data-extraction assistant. The user will give you a WhatsApp group chat export.

Return a JSON object with exactly three keys:

"passengers": array of people sharing travel information FOR THE FIRST TIME in this chat segment.
  Each object must have these exact keys: name, phone, flight_number, arrival_date (YYYY-MM-DD or null),
  arrival_time (HH:MM or null), departure_date (YYYY-MM-DD or null), departure_time (HH:MM or null),
  origin (city or airport travelling FROM, or null), destination (city or airport travelling TO, or null),
  additional_details (pickup-relevant notes like wheelchair, baby seat, extra luggage, meeting point — concise, or null), raw_text.
  Use null for any missing field.

"cancellations": array of objects { name, phone } for people who explicitly cancelled, withdrew,
  or asked to be removed from the pickup. Use null for whichever identifier is not mentioned.
  Return empty array if none.

"updates": array of people CORRECTING or CHANGING previously shared travel details
  (signals: "actually", "change of plan", "new flight", "updated", "instead", "not anymore", "changed to").
  Same schema as passengers entries. Include only the fields that changed; use null for unchanged fields.
  Do NOT also include these people in "passengers".
  Return empty array if none.

Return ONLY the JSON object, no prose.`

// Matches both iOS: [14/06/2024, 16:30:00] Name: …
// and Android:      14/06/2024, 16:30 - Name: …
const MSG_RE = /^(\[?)(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*[-–]?\s*/

interface ParsedMessage {
  ts: Date
  line: string
}

function extractMessages(text: string): ParsedMessage[] {
  const lines = text.split('\n')
  const result: ParsedMessage[] = []

  for (const line of lines) {
    const m = line.match(MSG_RE)
    if (!m) continue

    const day = parseInt(m[2])
    const month = parseInt(m[3]) - 1
    const year = parseInt(m[4].length === 2 ? '20' + m[4] : m[4])
    const hour = parseInt(m[5])
    const min = parseInt(m[6])
    const sec = m[7] ? parseInt(m[7]) : 0

    const ts = new Date(year, month, day, hour, min, sec)
    if (!isNaN(ts.getTime())) {
      result.push({ ts, line })
    }
  }

  return result
}

function extractParticipantNames(messages: ParsedMessage[]): Set<string> {
  const names = new Set<string>()
  // After the timestamp prefix, the sender name is before the first ':'
  const senderRe = /^(?:\[?\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*)([^:]+):/
  for (const { line } of messages) {
    const m = line.match(senderRe)
    if (m) names.add(m[1].trim().toLowerCase())
  }
  return names
}

export async function POST(req: NextRequest) {
  let projectId: string, filePath: string, forceMerge: boolean
  try {
    const body = await req.json()
    projectId = body.projectId
    filePath = body.filePath
    forceMerge = body.forceMerge
  } catch (e) {
    return NextResponse.json({ error: `Bad request body: ${e}` }, { status: 400 })
  }

  if (!projectId || !filePath) {
    return NextResponse.json({ error: 'Missing projectId or filePath' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 1. Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('chat-exports')
    .download(filePath)

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: downloadError?.message ?? 'Failed to download file' },
      { status: 500 }
    )
  }

  const chatText = await fileData.text()

  // 2. Extract all message timestamps from the file
  const allMessages = extractMessages(chatText)
  const latestTs = allMessages.reduce<Date | null>((max, { ts }) => (!max || ts > max ? ts : max), null)
  const canParseTimes = allMessages.length > 0

  // 3. Fetch project state: existing watermark + existing passenger names
  const [{ data: project }, { data: existingPassengers }] = await Promise.all([
    supabase.from('projects').select('last_message_at, org_id').eq('id', projectId).single(),
    supabase.from('passengers').select('name').eq('project_id', projectId).eq('is_deleted', false),
  ])

  const existingWatermark = project?.last_message_at ? new Date(project.last_message_at) : null

  // 4. Delta filter — only messages strictly after the watermark
  // If timestamps can't be parsed (unknown format), fall back to full text with no delta
  let messagesToProcess = allMessages
  let deltaText = chatText
  if (canParseTimes) {
    if (existingWatermark) {
      messagesToProcess = allMessages.filter(({ ts }) => ts > existingWatermark)
      if (messagesToProcess.length === 0) {
        await supabase.storage.from('chat-exports').remove([filePath])
        return NextResponse.json({ noNewMessages: true })
      }
    }
    deltaText = messagesToProcess.map(m => m.line).join('\n')
  }

  if (!deltaText.trim()) {
    await supabase.storage.from('chat-exports').remove([filePath])
    return NextResponse.json({ noNewMessages: true })
  }

  // 5. Wrong-file check (skip if forceMerge or first import)
  const existingNames = new Set(
    (existingPassengers ?? []).map(p => (p.name ?? '').trim().toLowerCase()).filter(Boolean)
  )
  if (!forceMerge && existingNames.size >= 3) {
    const fileParticipants = extractParticipantNames(messagesToProcess)
    const overlap = [...fileParticipants].filter(n => existingNames.has(n)).length
    if (overlap === 0) {
      await supabase.storage.from('chat-exports').remove([filePath])
      return NextResponse.json({ warning: 'different_chat' })
    }
  }

  // 7. Send to Claude Haiku 5.5
  // Sanitize: replace non-Latin-1 chars (codepoint > 255) with ASCII equivalents.
  // The Anthropic SDK internally calls btoa() which rejects codepoints > 255,
  // and WhatsApp exports commonly contain characters like • (U+2022 = 8226).
  const safeText = deltaText.replace(/[^\x00-\xFF]/g, (ch) => {
    const map: Record<string, string> = {
      '•': '*',    // bullet •
      '‘': "'", '’': "'",   // smart single quotes
      '“': '"', '”': '"',   // smart double quotes
      '–': '-',  '—': '--', // en/em dash
      '…': '...', // ellipsis
      '‎': '', '‏': '',     // LTR/RTL marks
      '‪': '', '‫': '', '‬': '', '‭': '', '‮': '', // directional embeddings
    }
    return map[ch] ?? ' '
  })

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: safeText }],
    })
  } catch (e) {
    await supabase.storage.from('chat-exports').remove([filePath])
    return NextResponse.json({ error: `AI call failed: ${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  const content = message.content.find(b => b.type === 'text')
  if (!content || content.type !== 'text') {
    return NextResponse.json({ error: 'No text in AI response' }, { status: 500 })
  }

  type PassengerRow = {
    name: string | null; phone: string | null; flight_number: string | null
    arrival_date: string | null; arrival_time: string | null
    departure_date: string | null; departure_time: string | null
    origin: string | null; destination: string | null
    additional_details: string | null; raw_text: string | null
  }
  type CancelRow = { name: string | null; phone: string | null }

  // 8. Parse JSON response
  let passengers: PassengerRow[] = []
  let cancellations: CancelRow[] = []
  let updates: PassengerRow[] = []

  try {
    const text = content.text.trim()
    const json = text.startsWith('```') ? text.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '') : text
    const parsed = JSON.parse(json)
    // Support both old plain-array format and new object format
    if (Array.isArray(parsed)) {
      passengers = parsed
    } else {
      passengers = parsed.passengers ?? []
      cancellations = parsed.cancellations ?? []
      updates = parsed.updates ?? []
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 })
  }

  // 9. Bulk-insert new passengers — sort_order starts from global project max + 1
  if (passengers.length > 0) {
    const { data: maxRow } = await supabase
      .from('passengers')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const baseOrder = (maxRow?.sort_order ?? -1) + 1

    const rows = passengers.map((p, i) => ({
      project_id: projectId,
      name: p.name,
      phone: p.phone,
      flight_number: p.flight_number,
      arrival_date: p.arrival_date,
      arrival_time: p.arrival_time,
      departure_date: p.departure_date,
      departure_time: p.departure_time,
      origin: p.origin,
      destination: p.destination,
      additional_details: p.additional_details ?? null,
      additional_details_updated_by: p.additional_details ? 'client' : null,
      raw_text: p.raw_text,
      sort_order: baseOrder + i,
    }))

    const { error: insertError } = await supabase.from('passengers').insert(rows)
    if (insertError) {
      await supabase.storage.from('chat-exports').remove([filePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // 9b. Apply updates — patch changed fields on existing passengers
  for (const u of updates) {
    const patch: Record<string, unknown> = {}
    if (u.flight_number  !== null) patch.flight_number  = u.flight_number
    if (u.arrival_date   !== null) patch.arrival_date   = u.arrival_date
    if (u.arrival_time   !== null) patch.arrival_time   = u.arrival_time
    if (u.departure_date !== null) patch.departure_date = u.departure_date
    if (u.departure_time !== null) patch.departure_time = u.departure_time
    if (u.origin         !== null) patch.origin         = u.origin
    if (u.destination    !== null) patch.destination    = u.destination
    if (u.additional_details !== null) patch.additional_details = u.additional_details
    if (u.phone          !== null) patch.phone          = u.phone
    if (Object.keys(patch).length === 0) continue

    if (u.name) {
      await supabase.from('passengers').update(patch)
        .eq('project_id', projectId).ilike('name', u.name.trim())
    } else if (u.phone) {
      await supabase.from('passengers').update(patch)
        .eq('project_id', projectId).eq('phone', u.phone.trim())
    }
  }

  // 9c. Soft-delete cancellations
  for (const c of cancellations) {
    if (c.name) {
      await supabase.from('passengers').update({ is_deleted: true })
        .eq('project_id', projectId).ilike('name', c.name.trim())
    } else if (c.phone) {
      await supabase.from('passengers').update({ is_deleted: true })
        .eq('project_id', projectId).eq('phone', c.phone.trim())
    }
  }

  // 10. Update watermark + project timestamps
  const arrivalDates = passengers.map(p => p.arrival_date).filter(Boolean) as string[]
  const lastMessageDate = arrivalDates.length > 0 ? arrivalDates.sort().at(-1) : null
  await supabase.from('projects').update({
    last_updated_at: new Date().toISOString(),
    last_message_date: lastMessageDate ?? undefined,
    last_message_at: latestTs?.toISOString() ?? undefined,
  }).eq('id', projectId)

  // 11. Bundle passengers into cabs
  await bundlePassengersIntoCabs(projectId, supabase, project?.org_id ?? undefined)

  // 12. Delete uploaded file from Storage
  await supabase.storage.from('chat-exports').remove([filePath])

  return NextResponse.json({ count: passengers.length, cancelled: cancellations.length, updated: updates.length })
}
