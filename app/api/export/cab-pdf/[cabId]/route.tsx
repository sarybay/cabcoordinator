import { renderToBuffer } from '@react-pdf/renderer'
import { createServerClient } from '@/lib/supabaseServer'
import { createAuthClient } from '@/lib/supabaseAuth'
import { NextRequest, NextResponse } from 'next/server'
import { CabPdf } from '@/lib/cabPdf'
import type { CabPdfPassenger } from '@/lib/cabPdf'
import React from 'react'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cabId: string }> }) {
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cabId } = await params
  const supabase = createServerClient()

  const { data: cab, error: cabErr } = await supabase
    .from('cabs').select('label, price, project_id').eq('id', cabId).single()

  if (cabErr || !cab) {
    return new NextResponse('Cab not found', { status: 404 })
  }

  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('name, org_id').eq('id', cab.project_id as string).single(),
    supabase
      .from('passengers')
      .select('name, phone, flight_number, origin, destination, arrival_date, arrival_time, additional_details')
      .eq('cab_id', cabId)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true }),
  ])

  const { data: org } = project?.org_id
    ? await supabase.from('organisations').select('name, coordinator_phone').eq('id', project.org_id as string).single()
    : { data: null }

  const orgName = ((org as { name?: string | null } | null)?.name ?? (project as { name?: string | null } | null)?.name ?? 'Transfer') as string
  const coordinatorPhone = (org as { coordinator_phone?: string | null } | null)?.coordinator_phone ?? null

  const passengers: CabPdfPassenger[] = (rows ?? []).map(r => ({
    name: r.name as string | null,
    phone: r.phone as string | null,
    flightNumber: r.flight_number as string | null,
    origin: r.origin as string | null,
    destination: r.destination as string | null,
    arrivalDate: r.arrival_date as string | null,
    arrivalTime: r.arrival_time as string | null,
    additionalDetails: r.additional_details as string | null,
  }))

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(React.createElement(CabPdf, {
    orgName,
    coordinatorPhone,
    passengers,
    cabLabel: cab.label as string,
    cabPrice: (cab.price as number | null),
    generatedAt,
  }) as any)

  const today = new Date().toISOString().slice(0, 10)
  const projectSlug = (project?.name ?? 'project').replace(/[^a-z0-9]/gi, '_')
  const cabSlug = (cab.label as string).replace(/[^a-z0-9]/gi, '_')
  const lastNames = passengers
    .map(p => (p.name ?? '').trim().split(/\s+/).pop() ?? '')
    .filter(Boolean)
    .join('_')
  const filename = [today, projectSlug, cabSlug, lastNames].filter(Boolean).join('_') + '.pdf'
  return new NextResponse(buf as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
