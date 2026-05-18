import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Apartamente ──────────────────────────────────────────────
export async function getApartamente() {
  const { data, error } = await supabase
    .from('apartamente')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function updateApartament(nr, fields) {
  const { error } = await supabase
    .from('apartamente')
    .update(fields)
    .eq('nr', nr)
  if (error) throw error

  // Daca se seteaza data_elib, programeaza automat curatenie generala
  if (fields.data_elib && fields.data_elib.trim()) {
    await programeazaCuratenieAutoElib(nr, fields.data_elib)
  }

  await addLog('admin', 'Update apt', nr, JSON.stringify(fields))
}

// Programeaza automat curatenie generala la data eliberarii
async function programeazaCuratenieAutoElib(nrApt, dataElib) {
  try {
    // Converteste data din format dd.mm, dd.mm.yyyy sau yyyy-mm-dd
    let dataFormatata = dataElib
    if (typeof dataElib === 'string' && dataElib.includes('.')) {
      const parts = dataElib.split('.')
      if (parts.length === 2) {
        const an = new Date().getFullYear()
        dataFormatata = `${an}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
      } else if (parts.length === 3) {
        dataFormatata = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
      }
    }
    // Daca e deja in format yyyy-mm-dd, ramane asa

    // Verifica daca data e valida
    const d = new Date(dataFormatata)
    if (isNaN(d)) return

    // Verifica daca exista deja curatenie generala pe aceasta data pentru acest apartament
    const { data: existing } = await supabase
      .from('curatenie')
      .select('id')
      .eq('nr_apt', nrApt)
      .eq('data_programata', dataFormatata)
      .eq('tip_curatenie', 'generala')
      .neq('status_curatenie', 'finalizata')

    if (existing && existing.length > 0) return // deja exista

    // Ia detalii apartament
    const { data: aptData } = await supabase
      .from('apartamente')
      .select('*')
      .eq('nr', nrApt)
      .single()

    // Programeaza curatenie generala
    await supabase.from('curatenie').insert({
      data_programata: dataFormatata,
      nr_apt: nrApt,
      tip_apt: aptData?.tip || 'simplu',
      firma: aptData?.firma || '',
      tip_curatenie: 'generala',
      status_curatenie: 'programata',
      observatii: `Auto-programat la eliberare (${dataElib})`,
      amanare_status: ''
    })

    await supabase.from('apartamente').update({ curatenie_status: 'programata' }).eq('nr', nrApt)
    await addLog('admin', 'Auto-curatenie generala la elib', nrApt, dataFormatata)
  } catch(e) {
    console.error('Auto-curatenie error:', e)
  }
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
    .upsert({
      nr: apt.nr, tip: apt.tip, firma: apt.firma, nota: apt.nota,
      status: apt.status, pret: apt.pret, plata: apt.plata,
      tip_serviciu: apt.tip_serviciu || 'cazare',
      pret_utilitati: apt.pret_utilitati || 0,
      utilitati_tip: apt.utilitati_tip || 'fix'
    })
  if (error) throw error
  await addLog('admin', 'Adaugat apt', apt.nr, apt.firma)
}

// ── Curatenie ────────────────────────────────────────────────
export async function getCuratenie() {
  const { data, error } = await supabase
    .from('curatenie')
    .select('*')
    .order('data_programata', { ascending: false })
  if (error) throw error
  return data
}

export async function getCuratenieAzi() {
  const today = new Date()
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0')
  const { data, error } = await supabase
    .from('curatenie')
    .select('*')
    .eq('data_programata', todayStr)
    .order('id', { ascending: true })
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
    observatii: obj.observatii || '',
    amanare_status: ''
  })
  if (error) throw error
  await supabase.from('apartamente').update({ curatenie_status: 'programata' }).eq('nr', obj.nr_apt)
  await addLog('admin', 'Programat curatenie', obj.nr_apt, `${obj.tip_curatenie} pe ${obj.data_programata}`)
}

export async function programeazaCuratenieMultipla(nrList, data, tip, obs, apts) {
  if (!nrList || nrList.length === 0) return
  const rows = nrList.map(nr => {
    const apt = apts.find(a => a.nr === nr)
    return {
      data_programata: data, nr_apt: nr,
      tip_apt: apt?.tip || 'simplu', firma: apt?.firma || '',
      tip_curatenie: tip, status_curatenie: 'programata',
      observatii: obs || '', amanare_status: ''
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

// ── Amanare ──────────────────────────────────────────────────
export async function propuneAmanare(id, dataNoua, motiv, dataOriginala) {
  const { error } = await supabase.from('curatenie').update({
    amanare_propusa: dataNoua, amanare_motiv: motiv,
    amanare_status: 'propusa', data_originala: dataOriginala
  }).eq('id', id)
  if (error) throw error
  await addLog('curatenie', 'Amanare propusa', '', `${dataOriginala} -> ${dataNoua}: ${motiv}`)
}

export async function aprobaAmanare(id) {
  const { data: row, error: err } = await supabase.from('curatenie').select('*').eq('id', id).single()
  if (err) throw err
  const { error } = await supabase.from('curatenie').update({
    data_programata: row.amanare_propusa,
    amanare_status: 'aprobata', status_curatenie: 'programata'
  }).eq('id', id)
  if (error) throw error
  await addLog('admin', 'Amanare aprobata', row.nr_apt, `-> ${row.amanare_propusa}`)
}

export async function respingeAmanare(id) {
  const { data: row, error: err } = await supabase.from('curatenie').select('*').eq('id', id).single()
  if (err) throw err
  const { error } = await supabase.from('curatenie').update({
    amanare_status: 'respinsa', amanare_propusa: null, amanare_motiv: ''
  }).eq('id', id)
  if (error) throw error
  await addLog('admin', 'Amanare respinsa', row.nr_apt, '')
}

export async function amanareDirecta(id, dataNoua, motiv) {
  const { data: row, error: err } = await supabase.from('curatenie').select('*').eq('id', id).single()
  if (err) throw err
  const { error } = await supabase.from('curatenie').update({
    data_originala: row.data_originala || row.data_programata,
    data_programata: dataNoua, amanare_motiv: motiv,
    amanare_status: 'aprobata', status_curatenie: 'programata'
  }).eq('id', id)
  if (error) throw error
  await addLog('admin', 'Amanare directa', row.nr_apt, `-> ${dataNoua}: ${motiv}`)
}

// ── Mentenanta ───────────────────────────────────────────────
export async function getMentenanta() {
  const { data, error } = await supabase
    .from('mentenanta').select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function adaugaMentenanta(obj, fotografie) {
  let foto_url = ''
  if (fotografie) {
    const ext = fotografie.name.split('.').pop()
    const fileName = `apt${obj.nr_apt}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('mentenanta-foto').upload(fileName, fotografie)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('mentenanta-foto').getPublicUrl(fileName)
      foto_url = urlData.publicUrl
    }
  }
  const { error } = await supabase.from('mentenanta').insert({
    nr_apt: obj.nr_apt, firma: obj.firma || '',
    descriere: obj.descriere, foto_url, status: 'nou'
  })
  if (error) throw error
  await addLog('curatenie', 'Mentenanta raportata', obj.nr_apt, obj.descriere)
}

export async function updateStatusMentenanta(id, status) {
  const { error } = await supabase.from('mentenanta').update({ status }).eq('id', id)
  if (error) throw error
}

export async function stergeMentenanta(id) {
  const { error } = await supabase.from('mentenanta').delete().eq('id', id)
  if (error) throw error
}

// ── Statistici ───────────────────────────────────────────────
export async function getStatistici() {
  const { data, error } = await supabase
    .from('curatenie').select('*')
    .eq('status_curatenie', 'finalizata')
    .or('deja_curat.is.null,deja_curat.eq.false')
    .order('data_programata', { ascending: false })
  if (error) throw error

  const peLuna = {}, peSaptamana = {}, peZi = {}
  data.forEach(c => {
    if (!c.data_programata) return
    const d = new Date(c.data_programata)
    const an = d.getFullYear(), luna = d.getMonth(), zi = d.getDate()
    const keyLuna = `${an}-${String(luna+1).padStart(2,'0')}`
    if (!peLuna[keyLuna]) peLuna[keyLuna] = { total: 0, curatenii: [] }
    peLuna[keyLuna].total++; peLuna[keyLuna].curatenii.push(c)

    const startSapt = new Date(d)
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
    startSapt.setDate(d.getDate() - dow)
    const endSapt = new Date(startSapt); endSapt.setDate(startSapt.getDate() + 6)
    const fmt = dt => `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`
    const keySapt = `${fmt(startSapt)}-${fmt(endSapt)}.${endSapt.getFullYear()}`
    if (!peSaptamana[keySapt]) peSaptamana[keySapt] = { total: 0, start: startSapt, curatenii: [] }
    peSaptamana[keySapt].total++; peSaptamana[keySapt].curatenii.push(c)

    const keyZi = `${an}-${String(luna+1).padStart(2,'0')}-${String(zi).padStart(2,'0')}`
    if (!peZi[keyZi]) peZi[keyZi] = { total: 0, curatenii: [] }
    peZi[keyZi].total++; peZi[keyZi].curatenii.push(c)
  })
  return { peLuna, peSaptamana, peZi, total: data.length }
}

// ── Istoric ──────────────────────────────────────────────────
export async function getIstoric() {
  const { data, error } = await supabase
    .from('istoric_firme').select('*')
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
  } catch(e) {}
}
