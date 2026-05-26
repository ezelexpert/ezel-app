import { supabase } from './supabase'

// ════════════════════════════════════════════════════════════════════
// EZEL — Auth (versiunea sigură, înlocuiește auth.js vechi)
//
// Schimbări față de versiunea veche:
// 1. Login prin RPC (parola e hash bcrypt în DB, nu plain text)
// 2. Session token cryptographically random (32 bytes), nu base64 predictibil
// 3. Token-ul nu mai poate fi forjat în client (era btoa(rol_data_EZEL))
// 4. Suport pentru rate limiting (failed_attempts + locked_until)
// 5. Compatibil cu API-ul vechi - aceleași funcții exportate
// ════════════════════════════════════════════════════════════════════

const SESSION_TTL_HOURS = 12

// ── Storage helpers ──────────────────────────────────────────────
function saveSession(user, token) {
  const expiry = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString()
  localStorage.setItem('ezel_user', JSON.stringify({
    id: user.id,
    nume: user.nume,
    rol: user.rol
  }))
  localStorage.setItem('ezel_token', token)
  localStorage.setItem('ezel_expiry', expiry)
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

// Compatibil cu App.js și LoginPage
export function getSession() {
  try {
    const user = getUser()
    const token = localStorage.getItem('ezel_token')
    const expiry = localStorage.getItem('ezel_expiry')

    if (!user || !token || !expiry) return null

    // Verifică expirarea
    if (new Date(expiry) < new Date()) {
      logout()
      return null
    }

    return { role: user.rol, user, token }
  } catch (e) {
    return null
  }
}

export function logout() {
  localStorage.removeItem('ezel_user')
  localStorage.removeItem('ezel_token')
  localStorage.removeItem('ezel_expiry')
  // compat cu chei vechi
  localStorage.removeItem('ezel_role')
  localStorage.removeItem('ezel_date')
}

// ── Login (înlocuiește login-ul vechi cu SELECT direct) ──────────
// Acceptă fie (nume, parolă), fie (parolă) singură pentru compat cu codul vechi
// care făcea "caută user cu această parolă"
export async function loginCuNumeSiParola(numeOrId, parola) {
  try {
    const { data, error } = await supabase.rpc('login_user', {
      p_nume: numeOrId,
      p_parola: parola
    })

    if (error) {
      // Mesajul de eroare e standardizat din DB
      if (error.message?.includes('invalid_credentials')) {
        return { error: 'Nume sau parolă incorect.' }
      }
      if (error.message?.includes('account_locked')) {
        return { error: 'Cont blocat temporar. Reîncearcă peste 15 minute.' }
      }
      return { error: 'Eroare de autentificare.' }
    }

    if (!data || data.length === 0) {
      return { error: 'Nume sau parolă incorect.' }
    }

    const result = data[0]
    const user = { id: result.id, nume: result.nume, rol: result.rol, activ: result.activ }
    saveSession(user, result.session_token)
    return { user }
  } catch (e) {
    console.error('Login error:', e)
    return { error: 'Eroare de conexiune.' }
  }
}

// ── Login DOAR cu parolă (pentru flow-ul "Manager/Curățenie" + parolă) ──
// Caută orice utilizator activ care are parola dată ȘI rolul potrivit.
// Pentru asta avem nevoie de o funcție RPC dedicată.
//
// NOTĂ: această variantă e mai puțin sigură (oricine cu parola "1997"
// se loghează ca utilizatorul respectiv). Recomand să forțezi
// login cu nume+parolă în loc de doar parolă.
export async function loginDoarCuParola(parola, tipRol) {
  // Pentru compat cu flow-ul vechi - cere nume utilizator
  // dacă nu există RPC pentru "find by password"
  // Soluția corectă: arată dropdown cu nume + cere parola.

  // Ia lista de utilizatori cu rolul cerut
  const roluri = tipRol === 'admin' ? ['admin'] : ['curatenie', 'lenjerii']
  const { data: useri, error: errUseri } = await supabase
    .from('utilizatori_public')  // VIEW fără parola_hash
    .select('id, nume, rol, activ')
    .in('rol', roluri)
    .eq('activ', true)

  if (errUseri || !useri?.length) {
    return { error: 'Nu există utilizatori pentru acest rol.' }
  }

  // Încearcă login cu fiecare nume - inefficient dar functional
  // pe termen scurt. Pe termen lung, schimbă UI-ul să ceară nume.
  for (const u of useri) {
    const result = await loginCuNumeSiParola(u.nume, parola)
    if (result.user) return result
  }

  return { error: 'Parolă incorectă.' }
}

// ── Schimbă parola ───────────────────────────────────────────────
export async function schimbaParola(parolaVeche, parolaNoua) {
  const user = getUser()
  if (!user) return { error: 'Nu ești autentificat.' }

  if (parolaNoua.length < 8) {
    return { error: 'Parola trebuie să aibă minim 8 caractere.' }
  }

  try {
    const { data, error } = await supabase.rpc('change_password', {
      p_user_id: user.id,
      p_parola_veche: parolaVeche,
      p_parola_noua: parolaNoua
    })

    if (error || !data) {
      return { error: 'Parola veche este incorectă.' }
    }

    return { ok: true }
  } catch (e) {
    return { error: 'Eroare la schimbarea parolei.' }
  }
}

// ── Adaugă user (admin only) ─────────────────────────────────────
export async function adaugaUtilizator(nume, parola, rol) {
  const current = getUser()
  if (current?.rol !== 'admin') return { error: 'Nu ai permisiuni.' }

  try {
    const { data, error } = await supabase.rpc('add_user', {
      p_nume: nume,
      p_parola: parola,
      p_rol: rol
    })

    if (error) {
      if (error.message?.includes('parola_prea_scurta')) {
        return { error: 'Parola trebuie să aibă minim 8 caractere.' }
      }
      if (error.message?.includes('rol_invalid')) {
        return { error: 'Rol invalid.' }
      }
      return { error: error.message || 'Eroare la adăugare.' }
    }

    return { id: data, ok: true }
  } catch (e) {
    return { error: 'Eroare la adăugare.' }
  }
}

// ── Resetează parola altui user (admin only) ────────────────────
export async function reseteazaParola(userId, parolaNoua) {
  const current = getUser()
  if (current?.rol !== 'admin') return { error: 'Nu ai permisiuni.' }

  if (parolaNoua.length < 8) {
    return { error: 'Parola trebuie să aibă minim 8 caractere.' }
  }

  try {
    const { data, error } = await supabase.rpc('admin_set_password', {
      p_user_id: userId,
      p_parola_noua: parolaNoua
    })

    if (error || !data) {
      return { error: 'Eroare la resetare.' }
    }

    return { ok: true }
  } catch (e) {
    return { error: 'Eroare la resetare.' }
  }
}

// ── Lista utilizatori pentru dropdown (fără parolă_hash) ────────
export async function getUtilizatori() {
  try {
    const { data } = await supabase
      .from('utilizatori_public')  // VIEW care nu expune parola_hash
      .select('id, nume, rol, activ')
      .eq('activ', true)
      .order('rol', { ascending: false })
    return data || []
  } catch (e) {
    return []
  }
}

// ── Compat cu API-ul vechi ──────────────────────────────────────
// saveUser e folosit în LoginPage - îl păstrăm dar acum doar pentru UI
export function saveUser(user) {
  // în noul flow, sesiunea e setată automat de loginCuNumeSiParola
  // dar dacă cineva apelează saveUser direct, măcar salvăm minimal
  console.warn('saveUser() este deprecated. Folosește loginCuNumeSiParola().')
  localStorage.setItem('ezel_user', JSON.stringify({
    id: user.id, nume: user.nume, rol: user.rol
  }))
}

// Compat
export function login(parola, tip) { return false }
