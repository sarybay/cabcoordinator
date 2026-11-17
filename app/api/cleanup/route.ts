import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabase
    .from('projects')
    .select('id')
    .lt('last_updated_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!stale?.length) return NextResponse.json({ deleted: 0 })

  const ids = stale.map(p => p.id)

  // cabs have no guaranteed CASCADE from projects, delete explicitly
  await supabase.from('cabs').delete().in('project_id', ids)
  await supabase.from('passengers').delete().in('project_id', ids)
  await supabase.from('projects').delete().in('id', ids)

  return NextResponse.json({ deleted: ids.length })
}
