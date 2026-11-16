import { renderToBuffer } from '@react-pdf/renderer'
import { createServerClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'
import { CabPdf } from '@/lib/cabPdf'
import type { CabPdfPassenger } from '@/lib/cabPdf'
import JSZip from 'jszip'
import React from 'react'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const supabase = createServerClient()

  const [{ data: project }, { data: cabs }] = await Promise.all([
    supabase.from('projects').select('name, org_id').eq('id', projectId).single(),
    supabase.from('cabs').select('id, label, price').eq('project_id', projectId).order('label'),
  ])

  if (!project || !cabs?.length) {
    return new NextResponse('No cabs found', { status: 404 })
  }

  const { data: org } = project.org_id
    ? await supabase.from('organisations').select('name, coordinator_phone').eq('id', project.org_id as string).single()
    : { data: null }

  const orgName = (org as { name?: string | null } | null)?.name ?? (project.name as string)
  const coordinatorPhone = (org as { coordinator_phone?: string | null } | null)?.coordinator_phone ?? null

  const { data: allPassengers } = await supabase
    .from('passengers')
    .select('cab_id, name, phone, flight_number, origin, destination, arrival_date, arrival_time, additional_details')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: true })

  const passengersByCab = new Map<string, CabPdfPassenger[]>()
  for (const r of allPassengers ?? []) {
    const cabId = r.cab_id as string
    if (!passengersByCab.has(cabId)) passengersByCab.set(cabId, [])
    passengersByCab.get(cabId)!.push({
      name: r.name as string | null,
      phone: r.phone as string | null,
      flightNumber: r.flight_number as string | null,
      origin: r.origin as string | null,
      destination: r.destination as string | null,
      arrivalDate: r.arrival_date as string | null,
      arrivalTime: r.arrival_time as string | null,
      additionalDetails: r.additional_details as string | null,
    })
  }

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const today = new Date().toISOString().slice(0, 10)
  const zip = new JSZip()

  for (const cab of cabs) {
    const passengers = passengersByCab.get(cab.id as string) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(React.createElement(CabPdf, {
      orgName,
      coordinatorPhone,
      passengers,
      cabLabel: cab.label as string,
      cabPrice: cab.price as number | null,
      generatedAt,
    }) as any)

    const cabSlug = (cab.label as string).replace(/[^a-z0-9]/gi, '_')
    const lastNames = passengers
      .map(p => (p.name ?? '').trim().split(/\s+/).pop() ?? '')
      .filter(Boolean)
      .join('_')
    const pdfName = [today, cabSlug, lastNames].filter(Boolean).join('_') + '.pdf'
    zip.file(pdfName, buf)
  }

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' })
  const projectSlug = (project.name as string).replace(/[^a-z0-9]/gi, '_')
  const zipName = `${today}_${projectSlug}_all_cabs.zip`

  return new NextResponse(zipBuf as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    },
  })
}
