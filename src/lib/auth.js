import { supabase } from './supabase'

// Salveaza utilizatorul curent in localStorage
export function saveUser(user) {
  localStorage.setItem('ezel_user', JSON.stringify(user))
}

export function getUser() {
  try {
    const u = localStorage.getItem('ezel_user')
    return u ? JSON.parse(u) : null
  } catch { return null }
}

export function logout() {
  localStorage.removeItem('ezel_user')
}

export function isLoggedIn() {
  return !!getUser()
}

export function getRole() {
  return getUser()?.rol || null
}

export function getNume() {
  return getUser()?.nume || ''
}

// Login cu verificare in Supabase
export async function login(nume, parola) {
  try {
    const { data, error } = await supabase
      .from('utilizatori')
      .select('*')
      .eq('parola', parola)
      .eq('activ', true)

    if (error || !data || data.length === 0) return null

    // Cauta dupa nume (case insensitive, partial)
    const user = data.find(u =>
      u.nume.toLowerCase().includes(nume.toLowerCase()) ||
      nume.toLowerCase().includes(u.nume.toLowerCase().split(' ')[0])
    )

    if (!user) return null

    saveUser(user)
    return user
  } catch(e) {
    console.error('Login error:', e)
    return null
  }
}

// Login rapid cu doar parola (pentru compatibilitate)
export async function loginCuParola(parola) {
  try {
    const { data, error } = await supabase
      .from('utilizatori')
      .select('*')
      .eq('parola', parola)
      .eq('activ', true)

    if (error || !data || data.length === 0) return null

    // Daca sunt mai multi cu aceeasi parola, returneaza lista
    return data
  } catch(e) {
    console.error('Login error:', e)
    return null
  }
}
