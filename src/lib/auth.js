import { supabase } from './supabase.js'

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  // Verify if admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    console.error('Admin login error:', profileError, profile);
    await supabase.auth.signOut()
    throw new Error('Access denied. Admin privileges required.')
  }

  return data.user
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  window.location.reload()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile && profile.is_admin ? { ...user, ...profile } : null
}
