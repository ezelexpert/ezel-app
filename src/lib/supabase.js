import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Apartamente ──────────────────────────────────────────────
export async function getApartamente() {
  const { data, error } = await supabase
    .from('apartamente')
    .select('*')
    .order('nr')
  if (error) throw error
  return data
}

export async function updateApartament(nr, fields) {
  const { error } = await supabase
    .from('apartamente')
    .update(fields)
    .eq('nr', nr)
  if (error) throw error
  await addLog('admin', 'Update apt', nr, JSON.stringify(fields))
}

export async function updateApartamenteMultiple(nrList, fields) {
  const { error } = await supabase
    .from('apartamente')
    .update(fields)
    .in('nr', nrList)
  if (error) throw error
  await addLog('admin', `Update multiplu (${nrList.length})`, nrList.join(','), JSON.stringify(fields))
}

export async function addApartament(apt) {
  const { error } = await supabase
    .from('apartamente')
    .upsert({ nr: apt.nr, tip: apt.tip, firma: apt.firma, nota: apt.nota, status: apt.status, pret: apt.pret, plata: apt.plata })
  if (error) throw error
  await addLog('admin', 'Adaugat apt', apt.nr, apt.firma)
}

// ── Curatenie ────────────────────────────────────────────────
export async function getCuratenie(filters = {}) {
  let q = supabase.from('curatenie').select('*').order('data_programata', { ascending: false })
  if (filters.data) q = q.eq('data_programata', filters.data)
  if (filters.status) q = q.eq('status_curatenie', filters.status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function programeazaCuratenie(obj) {
  const { error } = await supabase.from('curatenie').insert({
    data_programata: obj.data_programata,
    nr_apt: obj.nr_apt,
    tip_apt: obj.tip_apt || 'simplu',
    firma: obj.firma || '',
    tip_curatenie: obj.tip_curatenie,
    status_curatenie: 'programata',
    observatii: obj.observatii || ''
  })
  if (error) throw error
  await supabase.from('apartamente').update({ curatenie_status: 'programata' }).eq('nr', obj.nr_apt)
  await addLog('admin', 'Programat curatenie', obj.nr_apt, `${obj.tip_curatenie} pe ${obj.data_programata}`)
}

export async function programeazaCuratenieMultipla(nrList, data, tip, obs, apts) {
  const rows = nrList.map(nr => {
    const apt = apts.find(a => a.nr === nr)
    return {
      data_programata: data,
      nr_apt: nr,
      tip_apt: apt?.tip || 'simplu',
      firma: apt?.firma || '',
      tip_curatenie: tip,
      status_curatenie: 'programata',
      observatii: obs || ''
    }
  })
  const { error } = await supabase.from('curatenie').insert(rows)
  if (error) throw error
  await supabase.from('apartamente').update({ curatenie_status: 'programata' }).in('nr', nrList)
  await addLog('admin', `Curatenie multipla (${nrList.length})`, nrList.join(','), data)
}

export async function marcheazaStatus(id, status, nrApt) {
  const updateData = { status_curatenie: status }
  if (status === 'finalizata') {
    updateData.data_finalizare = new Date().toLocaleString('ro-RO')
    await supabase.from('apartamente').update({
      ultima_curatenie: new Date().toLocaleString('ro-RO'),
      curatenie_status: 'finalizata'
    }).eq('nr', nrApt)
  } else {
    await supabase.from('apartamente').update({ curatenie_status: status }).eq('nr', nrApt)
  }
  const { error } = await supabase.from('curatenie').update(updateData).eq('id', id)
  if (error) throw error
  await addLog('curatenie', `Status: ${status}`, nrApt, '')
}

export async function stergeCuratenie(id) {
  const { error } = await supabase.from('curatenie').delete().eq('id', id)
  if (error) throw error
}

// ── Istoric ──────────────────────────────────────────────────
export async function getIstoric() {
  const { data, error } = await supabase
    .from('istoric_firme')
    .select('*')
    .order('data_start', { ascending: false })
  if (error) throw error
  return data
}

export async function adaugaIstoric(obj) {
  const zile = obj.nr_zile || Math.max(0, Math.round((new Date(obj.data_end) - new Date(obj.data_start)) / 86400000))
  const total = zile * (Number(obj.pret_noapte) || 0)
  const { error } = await supabase.from('istoric_firme').insert({
    firma: obj.firma, nr_apt: obj.nr_apt, tip_apt: obj.tip_apt || 'simplu',
    data_start: obj.data_start, data_end: obj.data_end,
    pret_noapte: obj.pret_noapte, nr_zile: zile,
    total_estimat: total, observatii: obj.observatii || ''
  })
  if (error) throw error
}

export async function stergeIstoric(id) {
  const { error } = await supabase.from('istoric_firme').delete().eq('id', id)
  if (error) throw error
}

// ── Log ──────────────────────────────────────────────────────
export async function addLog(userTip, actiune, nrApt, detalii) {
  try {
    await supabase.from('log_actiuni').insert({ user_tip: userTip, actiune, nr_apt: nrApt, detalii })
  } catch (e) {}
}
