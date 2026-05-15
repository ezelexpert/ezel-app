const PAROLA_ADMIN = process.env.REACT_APP_PAROLA_ADMIN || 'ezel2024'
const PAROLA_CURATENIE = process.env.REACT_APP_PAROLA_CURATENIE || 'curat2024'

export function login(parola, tip) {
  const valid =
    (tip === 'admin' && parola === PAROLA_ADMIN) ||
    (tip === 'curatenie' && parola === PAROLA_CURATENIE)
  if (!valid) return false
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem('ezel_role', tip)
  localStorage.setItem('ezel_date', today)
  localStorage.setItem('ezel_token', btoa(`${tip}_${today}_EZEL`))
  return true
}

export function getSession() {
  try {
    const role  = localStorage.getItem('ezel_role')
    const date  = localStorage.getItem('ezel_date')
    const token = localStorage.getItem('ezel_token')
    const today = new Date().toISOString().split('T')[0]
    if (role && date === today && token === btoa(`${role}_${today}_EZEL`)) {
      return { role }
    }
  } catch (e) {}
  return null
}

export function logout() {
  localStorage.removeItem('ezel_role')
  localStorage.removeItem('ezel_date')
  localStorage.removeItem('ezel_token')
}
