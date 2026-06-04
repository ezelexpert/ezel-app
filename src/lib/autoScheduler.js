import { supabase } from './supabase'
import {
  getSetariZile,
  urmatoareaZiLucratoare as urmZiLucr,
  ziLucratoareInainte,
} from './zileLucratoare'

// Motorul de auto-planificare a fost mutat in baza de date (functia
// programeaza_curatenii_continuare + triggere). Aici a ramas doar
// curatenia INTERMEDIARA optionala (buton manual din modalul de apartament).

const CADENTA_MAX = 10 // interval maxim între curățenii (zile)

// ── Utilitare date ────────────────────────────────────────────
function dateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function parseDate(str) {
  if (!str) return null
  const d = new Date(str + 'T12:00:00')
  return isNaN(d) ? null : d
}

function addZile(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function diffZile(d1, d2) {
  const a = new Date(d1), b = new Date(d2)
  a.setHours(0,0,0,0); b.setHours(0,0,0,0)
  return Math.round((b - a) / 86400000)
}

// Wrapper: următoarea zi lucrătoare folosind setările (weekend + sărbători + override).
function urmatoareaZiLucratoare(d, setari) {
  return urmZiLucr(d, setari)
}

// ── Curatenie intermediara optionala (sejur <= 15 nopti) ──────
// Calculeaza data unei singure curatenii intermediare la mijlocul sejurului,
// snap pe zi lucratoare, strict intre check-in si check-out.
export function calculeazaDataIntermediara(checkinStr, checkoutStr, setari) {
  const checkin = parseDate(checkinStr)
  const checkout = parseDate(checkoutStr)
  if (!checkin || !checkout) return null
  const nopti = diffZile(checkin, checkout)
  if (nopti < 3) return null // prea scurt pentru o intermediara utila

  // Tinta: mijlocul sejurului, dar nu mai tarziu de 10 zile de la check-in (cadenta)
  let offset = Math.round(nopti / 2)
  if (offset > CADENTA_MAX) offset = CADENTA_MAX
  let target = urmatoareaZiLucratoare(addZile(checkin, offset), setari)

  // Trebuie sa ramana strict intre check-in si check-out (comparatie pe zile intregi)
  if (diffZile(checkin, target) >= nopti) {
    // tinta a ajuns la/dupa check-out -> cauta o zi lucratoare inainte de check-out
    target = ziLucratoareInainte(addZile(checkout, -1), setari, checkin)
  }
  if (!target) return null
  const dci = diffZile(checkin, target) // zile de la check-in
  if (dci <= 0 || dci >= nopti) return null
  return dateStr(target)
}

// Programeaza efectiv curatenia intermediara. Returneaza { ok, msg, data }.
export async function programeazaIntermediara(apt, checkinStr, checkoutStr) {
  try {
    const setari = await getSetariZile()
    const checkin = parseDate(checkinStr)
    const checkout = parseDate(checkoutStr)
    if (!checkin || !checkout) return { ok: false, msg: 'Lipsesc datele de check-in / check-out.' }
    const nopti = diffZile(checkin, checkout)
    if (nopti <= 0) return { ok: false, msg: 'Check-out trebuie sa fie dupa check-in.' }
    if (nopti > 15) return { ok: false, msg: 'Peste 15 nopti: intretinerea se programeaza automat.' }

    const data = calculeazaDataIntermediara(checkinStr, checkoutStr, setari)
    if (!data) return { ok: false, msg: 'Sejur prea scurt pentru o curatenie intermediara.' }

    // O singura programare per apartament per zi
    const { data: ex } = await supabase.from('curatenie')
      .select('id').eq('nr_apt', apt.nr).eq('data_programata', data)
    if (ex && ex.length > 0) return { ok: false, msg: `AP ${apt.nr} are deja o curatenie pe ${data}.` }

    const { error } = await supabase.from('curatenie').insert({
      data_programata: data,
      nr_apt: apt.nr,
      tip_apt: apt.tip || 'simplu',
      firma: apt.firma || '',
      tip_curatenie: 'intretinere',
      status_curatenie: 'programata',
      observatii: 'Intermediara (manual)',
      amanare_status: ''
    })
    if (error) return { ok: false, msg: error.message }

    await supabase.from('apartamente').update({ curatenie_status: 'programata' }).eq('nr', apt.nr)
    await supabase.from('log_actiuni').insert({
      user_tip: 'admin', actiune: 'Curatenie intermediara', nr_apt: apt.nr, detalii: data
    })
    return { ok: true, msg: `Curatenie intermediara programata pe ${data}.`, data }
  } catch (e) {
    console.error('[Intermediara]', e)
    return { ok: false, msg: e.message }
  }
}
