import { supabase } from './supabase'

// ──────────────────────────────────────────────────────────────
// Modul ZILE LUCRĂTOARE
// Gestionează ce zile sunt lucrătoare pentru curățenie:
//   • weekend on/off (sâmbătă + duminică)
//   • sărbători legale România (calculate automat) marcate nelucrătoare
//   • override manual per zi (buton „se lucrează / nu se lucrează")
//
// Setările sunt salvate în tabela `setari`, id = 'zile_lucratoare':
//   { weekend: bool, override: { 'YYYY-MM-DD': true|false } }
//   - override[zi] = true  → forțat lucrătoare (chiar dacă e sărbătoare/weekend)
//   - override[zi] = false → forțat nelucrătoare (chiar dacă e zi normală)
// ──────────────────────────────────────────────────────────────

const SETARE_ID = 'zile_lucratoare'

// ── Utilitare date ────────────────────────────────────────────
export function dateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function parseDate(str) {
  if (!str) return null
  const d = new Date(str + 'T12:00:00')
  return isNaN(d) ? null : d
}

// ── Sărbători legale România ──────────────────────────────────
// Paștele ortodox (dată gregoriană) — algoritm Meeus, valabil 1900–2099.
function pasteOrtodox(an) {
  const a = an % 4
  const b = an % 7
  const c = an % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const luna = Math.floor((d + e + 114) / 31)   // 3 = martie, 4 = aprilie
  const zi = ((d + e + 114) % 31) + 1
  // Rezultatul e în calendar iulian → +13 zile pentru gregorian (sec. XXI)
  const data = new Date(an, luna - 1, zi, 12, 0, 0)
  data.setDate(data.getDate() + 13)
  return data
}

const SARBATORI_FIXE = [
  ['01-01', 'Anul Nou'],
  ['01-02', 'Anul Nou'],
  ['01-24', 'Unirea Principatelor'],
  ['05-01', 'Ziua Muncii'],
  ['06-01', 'Ziua Copilului'],
  ['08-15', 'Adormirea Maicii Domnului'],
  ['11-30', 'Sfântul Andrei'],
  ['12-01', 'Ziua Națională'],
  ['12-25', 'Crăciun'],
  ['12-26', 'Crăciun'],
]

const _sarbCache = {}

// Returnează un obiect { 'YYYY-MM-DD': 'Nume sărbătoare' } pentru un an.
export function getSarbatoriRO(an) {
  if (_sarbCache[an]) return _sarbCache[an]
  const m = {}
  SARBATORI_FIXE.forEach(([md, nume]) => { m[`${an}-${md}`] = nume })

  const paste = pasteOrtodox(an)
  const add = (offset, nume) => {
    const d = new Date(paste)
    d.setDate(d.getDate() + offset)
    m[dateStr(d)] = nume
  }
  add(-2, 'Vinerea Mare')
  add(0, 'Paștele')
  add(1, 'Paștele (a doua zi)')
  add(49, 'Rusalii')
  add(50, 'Rusalii (a doua zi)')

  _sarbCache[an] = m
  return m
}

// Listă sortată [{ data, nume }] pentru un an (pentru afișare în panou).
export function listaSarbatoriRO(an) {
  const m = getSarbatoriRO(an)
  return Object.keys(m).sort().map(data => ({ data, nume: m[data] }))
}

// ── Setări (cache în memorie) ─────────────────────────────────
let _cache = null

export function defaultSetariZile() {
  return { weekend: false, override: {} }
}

export async function getSetariZile(force = false) {
  if (_cache && !force) return _cache
  try {
    const { data } = await supabase.from('setari').select('valoare').eq('id', SETARE_ID).single()
    const v = data && data.valoare && typeof data.valoare === 'object' ? data.valoare : {}
    _cache = { weekend: !!v.weekend, override: v.override || {} }
  } catch (e) {
    _cache = defaultSetariZile()
  }
  return _cache
}

export async function salveazaSetariZile(setari) {
  const valoare = { weekend: !!setari.weekend, override: setari.override || {} }
  const { error } = await supabase.from('setari').upsert({
    id: SETARE_ID, valoare, updated_at: new Date().toISOString()
  })
  if (error) throw error
  _cache = valoare
  return valoare
}

export function invalideazaCacheZile() { _cache = null }

// ── Logica zi lucrătoare ──────────────────────────────────────
// Ordinea de decizie:
//   1. override manual (prioritate maximă)
//   2. sărbătoare legală → nelucrătoare
//   3. weekend → nelucrătoare dacă setari.weekend === false
export function isZiLucratoare(d, setari) {
  const s = setari || _cache || defaultSetariZile()
  const dt = typeof d === 'string' ? parseDate(d) : d
  if (!dt) return false
  const ds = dateStr(dt)

  if (s.override && Object.prototype.hasOwnProperty.call(s.override, ds)) {
    return !!s.override[ds]
  }

  const sarb = getSarbatoriRO(dt.getFullYear())
  if (sarb[ds]) return false

  const zi = dt.getDay()
  if (zi === 0 || zi === 6) return !!s.weekend

  return true
}

// Următoarea zi lucrătoare (inclusiv ziua dată dacă e lucrătoare).
export function urmatoareaZiLucratoare(d, setari) {
  const r = typeof d === 'string' ? parseDate(d) : new Date(d)
  r.setHours(0, 0, 0, 0)
  let guard = 0
  while (!isZiLucratoare(r, setari) && guard < 120) {
    r.setDate(r.getDate() + 1)
    guard++
  }
  return r
}

// Cea mai apropiată zi lucrătoare ≤ unei date (caută în trecut), dar nu înainte de `limita`.
export function ziLucratoareInainte(d, setari, limita) {
  const r = typeof d === 'string' ? parseDate(d) : new Date(d)
  r.setHours(0, 0, 0, 0)
  let lim = null
  if (limita) {
    lim = typeof limita === 'string' ? parseDate(limita) : new Date(limita)
    if (lim) lim.setHours(0, 0, 0, 0)
  }
  let guard = 0
  while (!isZiLucratoare(r, setari) && guard < 120) {
    r.setDate(r.getDate() - 1)
    guard++
    if (lim && r < lim) return null
  }
  return r
}
