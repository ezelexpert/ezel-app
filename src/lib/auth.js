import { supabase } from './supabase'

// ── Salvare utilizator ────────────────────────────────────────
export function saveUser(user) {
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem('ezel_user', JSON.stringify(user))
  localStorage.setItem('ezel_role', user.rol)
  localStorage.setItem('ezel_date', today)
  localStorage.setItem('ezel_token', btoa(`${user.rol}_${today}_EZEL`))
}

export function getUser() {
  try {
    const u = localStorage.getItem('ezel_user')
    return u ? JSON.parse(u) : null
  } catch { return null }
}

export function getNume() {
  return getUser()?.nume || ''
}

export function getRole() {
  return getUser()?.rol || null
}

export function isLoggedIn() {
  return !!getSession()
}

// Compatibil cu App.js si LoginPage
export function getSession() {
  try {
    const role  = localStorage.getItem('ezel_role')
    const date  = localStorage.getItem('ezel_date')
    const token = localStorage.getItem('ezel_token')
    const today = new Date().toISOString().split('T')[0]
    if (role && date === today && token === btoa(`${role}_${today}_EZEL`)) {
      return { role }
    }
  } catch(e) {}
  return null
}

export function logout() {
  localStorage.removeItem('ezel_user')
  localStorage.removeItem('ezel_role')
  localStorage.removeItem('ezel_date')
  localStorage.removeItem('ezel_token')
}

// Login cu id utilizator + parola
export async function loginCuNumeSiParola(userId, parola) {
  try {
    const { data, error } = await supabase
      .from('utilizatori')
      .select('*')
      .eq('id', userId)
      .eq('parola', parola)
      .eq('activ', true)
      .single()
    if (error || !data) return null
    saveUser(data)
    return data
  } catch(e) { return null }
}

// Lista utilizatori pentru dropdown
export async function getUtilizatori() {
  try {
    const { data } = await supabase
      .from('utilizatori')
      .select('id, nume, rol')
      .eq('activ', true)
      .order('rol', { ascending: false })
    return data || []
  } catch(e) { return [] }
}

// Pastrat pentru compatibilitate
export function login(parola, tip) { return false }
