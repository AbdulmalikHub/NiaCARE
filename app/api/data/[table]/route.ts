import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const primaryKeys: Record<string, string> = {
  facilities: 'facility_id', facility_members: 'id', patients: 'patient_id', treatment_plans: 'treatment_plan_id', procedures: 'procedure_id', appointments: 'appointment_id', follow_ups: 'follow_up_id', braces_cases: 'case_id', root_canal_cases: 'case_id', subscriptions: 'subscription_id', payments: 'payment_id', staff_invitations: 'id', audit_logs: 'id',
}

const allowedTables = new Set([
  'facilities', 'facility_members', 'patients', 'treatment_plans', 'procedures',
  'appointments', 'follow_ups', 'braces_cases', 'root_canal_cases',
  'subscriptions', 'payments', 'staff_invitations', 'audit_logs',
])

function client(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase is not configured.')
  const headers: Record<string, string> = { apikey: key }
  const authorization = request.headers.get('authorization')
  if (authorization) headers.authorization = authorization
  return createClient(url, key, { global: { headers } })
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function scopedQuery(request: NextRequest, table: string) {
  const supabase = client(request)
  const user = await supabase.auth.getUser()
  if (user.error || !user.data.user) return { error: response({ error: 'Unauthorized' }, 401) }
  const facilityId = request.nextUrl.searchParams.get('facility_id')
  if (!facilityId) return { error: response({ error: 'facility_id is required' }, 400) }
  const membership = await supabase.from('facility_members').select('facility_id').eq('user_id', user.data.user.id).eq('facility_id', facilityId).maybeSingle()
  if (membership.error) return { error: response({ error: membership.error.message }, 400) }
  if (!membership.data) return { error: response({ error: 'Forbidden' }, 403) }
  return { supabase, facilityId }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!allowedTables.has(table)) return response({ error: 'Table is not available through this API.' }, 404)
  const scoped = await scopedQuery(request, table)
  if ('error' in scoped) return scoped.error
  let query = scoped.supabase.from(table).select('*').eq('facility_id', scoped.facilityId)
  const order = request.nextUrl.searchParams.get('order')
  if (order && /^[a-z_]+$/.test(order)) query = query.order(order, { ascending: false })
  const { data, error } = await query
  if (error) return response({ error: error.message }, 400)
  return response({ data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!allowedTables.has(table)) return response({ error: 'Table is not available through this API.' }, 404)
  const scoped = await scopedQuery(request, table)
  if ('error' in scoped) return scoped.error
  const body = await request.json()
  const { data, error } = await scoped.supabase.from(table).insert({ ...body, facility_id: scoped.facilityId }).select().single()
  if (error) return response({ error: error.message }, 400)
  return response({ data }, 201)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!allowedTables.has(table)) return response({ error: 'Table is not available through this API.' }, 404)
  const id = request.nextUrl.searchParams.get('id')
  const key = primaryKeys[table]
  if (!id || !key) return response({ error: 'id is required' }, 400)
  const scoped = await scopedQuery(request, table)
  if ('error' in scoped) return scoped.error
  const body = await request.json()
  delete body.facility_id
  const { data, error } = await scoped.supabase.from(table).update(body).eq(key, id).eq('facility_id', scoped.facilityId).select().single()
  if (error) return response({ error: error.message }, 400)
  return response({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params
  if (!allowedTables.has(table)) return response({ error: 'Table is not available through this API.' }, 404)
  const id = request.nextUrl.searchParams.get('id')
  const key = primaryKeys[table]
  if (!id || !key) return response({ error: 'id is required' }, 400)
  const scoped = await scopedQuery(request, table)
  if ('error' in scoped) return scoped.error
  const { error } = await scoped.supabase.from(table).delete().eq(key, id).eq('facility_id', scoped.facilityId)
  if (error) return response({ error: error.message }, 400)
  return response({ success: true })
}
