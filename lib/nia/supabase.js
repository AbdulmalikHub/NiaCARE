import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase public configuration is missing.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export async function getFacilityContext() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('facility_members')
    .select('facility_id, role, facilities(*)')
    .eq('user_id', user.id)
  if (error) throw error
  return { user, memberships: data || [] }
}

export async function listFacilityRows(table, facilityId, query = {}) {
  let request = supabase.from(table).select(query.select || '*').eq('facility_id', facilityId)
  if (query.order) request = request.order(query.order.column, { ascending: query.order.ascending ?? false })
  if (query.limit) request = request.limit(query.limit)
  const { data, error } = await request
  if (error) throw error
  return data || []
}

export async function createStaffInvitation({ facilityId, email, fullName, role, tokenHash, createdBy }) {
  const { data, error } = await supabase.from('staff_invitations').insert({
    facility_id: facilityId,
    email,
    full_name: fullName,
    role,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    created_by: createdBy,
  }).select().single()
  if (error) throw error
  return data
}

export async function consumeStaffInvitation(tokenHash, password) {
  const { data: invite, error: inviteError } = await supabase
    .from('staff_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (inviteError) throw inviteError
  if (!invite) throw new Error('This account creation link is invalid, expired, or already used.')
  const { error: signupError } = await supabase.auth.signUp({ email: invite.email, password, options: { data: { full_name: invite.full_name } } })
  if (signupError) throw signupError
  const { error: consumeError } = await supabase.from('staff_invitations').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'pending')
  if (consumeError) throw consumeError
  return invite
}
