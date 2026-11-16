import ExcelJS from 'exceljs'
import { createServerClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'

const CAB_FILLS: Record<string, string> = {
  blue:   'FFDBEAFE',
  green:  'FFDCFCE7',
  orange: 'FFFFEDD5',
  purple: 'FFF3E8FF',
  rose:   'FFFFE4E6',
  teal:   'FFCCFBF1',
  amber:  'FFFEF3C7',
  pink:   'FFFCE7F3',
}

type CabJoin = {
  label?: string
  color?: string | null
  price?: number | null
  drivers?: { name?: string } | null
  car_types?: { name?: string } | null
} | null

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const [{ data: rows }, { data: project }] = await Promise.all([
    supabase
      .from('passengers')
      .select('*, cabs(label, color, price, drivers(name), car_types(name))')
      .eq('project_id', id)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true }),
    supabase.from('projects').select('name').eq('id', id).single(),
  ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Passengers')

  ws.columns = [
    { header: '#',            key: 'idx',         width: 5  },
    { header: 'Name',         key: 'name',        width: 22 },
    { header: 'Phone',        key: 'phone',       width: 18 },
    { header: 'Flight',       key: 'flight',      width: 10 },
    { header: 'From',         key: 'origin',      width: 16 },
    { header: 'To',           key: 'destination', width: 16 },
    { header: 'Arrival date', key: 'arr_date',    width: 14 },
    { header: 'Arrival time', key: 'arr_time',    width: 13 },
    { header: 'Pick up time', key: 'pickup_time', width: 13 },
    { header: 'Cab',          key: 'cab',         width: 8  },
    { header: 'Driver',       key: 'driver',      width: 18 },
    { header: 'Car type',     key: 'car_type',    width: 14 },
    { header: 'Price',        key: 'price',       width: 10 },
    { header: 'Status',       key: 'status',      width: 12 },
    { header: 'Details',      key: 'details',     width: 30 },
  ]

  ws.getRow(1).font = { bold: true }

  for (const [i, r] of (rows ?? []).entries()) {
    const cab = r.cabs as CabJoin
    const cabLabel = cab?.label ?? ''
    const cabNum = cabLabel.match(/^Cab (\d+)$/)?.[1] ?? cabLabel
    const status = r.is_done ? 'Done' : cab ? 'Pending' : '—'

    const row = ws.addRow({
      idx:         i + 1,
      name:        r.name ?? '',
      phone:       r.phone ?? '',
      flight:      r.flight_number ?? '',
      origin:      r.origin ?? '',
      destination: r.destination ?? '',
      arr_date:    r.arrival_date ?? '',
      arr_time:    r.arrival_time ? String(r.arrival_time).slice(0, 5) : '',
      pickup_time: r.pickup_time ? String(r.pickup_time).slice(0, 5) : '',
      cab:         cabNum,
      driver:      cab?.drivers?.name ?? '',
      car_type:    cab?.car_types?.name ?? '',
      price:       cab?.price != null ? `€${cab.price}` : '',
      status,
      details:     r.additional_details ?? '',
    })

    const fill = cab?.color ? CAB_FILLS[cab.color as string] : null
    if (fill) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      })
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)
  const projectSlug = (project?.name ?? 'passengers').replace(/[^a-z0-9]/gi, '_')
  const filename = `${today}_${projectSlug}.xlsx`

  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
