import { supabase } from './supabase'

const MAX_PER_ZI = 12
const ZILE_IDEAL = 7
const ZILE_MAX = 10
const ELM_FIRME = ['elm', 'electromontaj']

function isELM(firma) {
  if (!firma) return false
  return ELM_FIRME.some(f => firma.toLowerCase().includes(f))
}

function dateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function addZile(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function diffZile(d1, d2) {
  const a = new Date(d1), b = new Date(d2)
  a.setHours(0,0,0,0); b.setHours(0,0,0,0)
  return Math.round((b - a) / 86400000)
}

function isLuniSauVineri(d) {
  const zi = d.getDay(); return zi === 1 || zi === 5
}

function zileSaptamana(luni) {
  const zile = []
  for (let i = 0; i < 5; i++) zile.push(addZile(luni, i))
  return zile
}

function luniSaptamanaViitoare() {
  const azi = new Date(); azi.setHours(0,0,0,0)
  const ziAzi = azi.getDay()
  const paneLuni = ziAzi === 0 ? 1 : (8 - ziAzi)
  return addZile(azi, paneLuni)
}

// Parseaza nota pentru frecventa curatenie
// Exemple: "2c/l", "1c/l", "2 c/l", "2C/L", "2cl", "1c/s" (saptamanal)
function parseazaNota(nota) {
  if (!nota) return null
  const normalized = nota.toLowerCase().replace(/\s/g, '')
  // Pattern: numar + c + / + l (lunar) sau s (saptamanal)
  const match = normalized.match(/(\d+)c\/?([ls])/)
  if (!match) return null
  const nr = parseInt(match[1])
  const tip = match[2] // 'l' = lunar, 's' = saptamanal
  if (isNaN(nr) || nr <= 0) return null
  return { nr, tip } // { nr: 2, tip: 'l' } = 2 pe luna
}

export async function genereazaSaptamana() {
  try {
    const luni = luniSaptamanaViitoare()
    const vineri = addZile(luni, 4)
    const luniStr = dateStr(luni)
    const vineriStr = dateStr(vineri)
    const azi = new Date(); azi.setHours(0,0,0,0)

    // Luna curenta pentru calcul c/l
    const lunaStart = new Date(luni.getFullYear(), luni.getMonth(), 1)
    const lunaEnd = new Date(luni.getFullYear(), luni.getMonth() + 1, 0)
    const lunaStartStr = dateStr(lunaStart)
    const lunaEndStr = dateStr(lunaEnd)

    console.log(`[AutoScheduler] Generez ${luniStr} - ${vineriStr}`)

    const { data: apts } = await supabase.from('apartamente').select('*').in('status', ['activ', 'elib'])
    if (!apts || apts.length === 0) return { programate: 0, skipped: 0 }

    const { data: existente } = await supabase.from('curatenie').select('*')
      .gte('data_programata', dateStr(azi)).neq('status_curatenie', 'finalizata')

    const deja = {}
    ;(existente || []).forEach(c => {
      if (!deja[c.nr_apt]) deja[c.nr_apt] = []
      deja[c.nr_apt].push(c.data_programata)
    })

    const deSchedulat = []
    const deProgramat = []
    let programate = 0, skipped = 0

    // ── STEP 1: Apartamente cu nota c/l ──────────────────────
    for (const apt of apts) {
      const frecventa = parseazaNota(apt.nota)
      if (!frecventa) continue

      // Curatenii deja facute/programate in luna saptamanii viitoare
      const { data: curLuna } = await supabase.from('curatenie').select('data_programata')
        .eq('nr_apt', apt.nr)
        .gte('data_programata', lunaStartStr)
        .lte('data_programata', lunaEndStr)

      const nrFacuteLuna = curLuna?.length || 0

      let targetLuna
      if (frecventa.tip === 's') {
        // Saptamanal - cate saptamani sunt in luna viitoare
        const saptInLuna = Math.ceil((lunaEnd.getDate()) / 7)
        targetLuna = frecventa.nr * saptInLuna
      } else {
        targetLuna = frecventa.nr
      }

      const ramas = targetLuna - nrFacuteLuna
      if (ramas <= 0) { skipped++; continue }

      // Distribuie ramas curatenii in saptamana viitoare
      for (let i = 0; i < ramas; i++) {
        deSchedulat.push({
          apt,
          targetDate: addZile(luni, Math.floor(i * 5 / ramas)),
          urgenta: false,
          isElm: isELM(apt.firma),
          zileTrecute: 0,
          fromNota: true
        })
      }
    }

    // ── STEP 2: Apartamente fara nota - logica 7-10 zile ─────
    for (const apt of apts) {
      if (parseazaNota(apt.nota)) continue // deja procesat mai sus

      const { data: ultimele } = await supabase.from('curatenie').select('data_programata')
        .eq('nr_apt', apt.nr).eq('status_curatenie', 'finalizata')
        .order('data_programata', { ascending: false }).limit(1)

      const ultimaData = ultimele?.[0]?.data_programata
        ? new Date(ultimele[0].data_programata) : new Date(azi)
      ultimaData.setHours(0,0,0,0)

      const zileTrecute = diffZile(ultimaData, azi)
      const zileRamase = ZILE_IDEAL - zileTrecute
      const zileMaxRamase = ZILE_MAX - zileTrecute

      const dateViitoare = (deja[apt.nr] || []).filter(d => d >= dateStr(azi))
      if (dateViitoare.length > 0) {
        const ceaMaiApropiata = dateViitoare.sort()[0]
        const zileParaCea = diffZile(azi, ceaMaiApropiata)
        if (zileTrecute + zileParaCea <= ZILE_MAX) continue
      }

      let targetOffset = Math.max(0, zileRamase)
      let urgenta = false
      if (zileMaxRamase <= 5) { urgenta = true; targetOffset = 0 }

      deSchedulat.push({
        apt, targetDate: addZile(azi, Math.max(targetOffset, 0)),
        urgenta, isElm: isELM(apt.firma), zileTrecute, fromNota: false
      })
    }

    if (deSchedulat.length === 0) return { programate: 0, skipped }

    deSchedulat.sort((a, b) => {
      if (a.urgenta !== b.urgenta) return b.urgenta - a.urgenta
      if (a.isElm !== b.isElm) return b.isElm - a.isElm
      return b.zileTrecute - a.zileTrecute
    })

    // ── STEP 3: Distribute uniform ───────────────────────────
    const zile = zileSaptamana(luni)
    const slot = {}
    zile.forEach(z => { slot[dateStr(z)] = 0 })
    ;(existente || []).forEach(c => {
      if (c.data_programata >= luniStr && c.data_programata <= vineriStr) {
        if (slot[c.data_programata] !== undefined) slot[c.data_programata]++
      }
    })

    function gasesteCeaMaiLibera(zileDisponibile) {
      let minCount = Infinity, ziGasita = null
      for (const z of zileDisponibile) {
        const ds = dateStr(z)
        if (slot[ds] < MAX_PER_ZI && slot[ds] < minCount) {
          minCount = slot[ds]; ziGasita = ds
        }
      }
      return ziGasita
    }

    // Apartamente cu data_elib in saptamana viitoare -> curatenie generala fix pe data elib
    for (const apt of apts.filter(a => a.status === 'elib' && a.data_elib >= luniStr && a.data_elib <= vineriStr)) {
      const areInSapt = (deja[apt.nr] || []).some(d => d >= luniStr && d <= vineriStr)
      if (areInSapt) continue
      deProgramat.push({
        data_programata: apt.data_elib, nr_apt: apt.nr,
        tip_apt: apt.tip || 'simplu', firma: apt.firma || '',
        tip_curatenie: 'generala', status_curatenie: 'programata',
        observatii: 'Auto-generat la eliberare', amanare_status: ''
      })
      slot[apt.data_elib] = (slot[apt.data_elib] || 0) + 1
      programate++
      if (!deja[apt.nr]) deja[apt.nr] = []
      deja[apt.nr].push(apt.data_elib)
    }

    // ELM - doar luni sau vineri
    const elmZile = zile.filter(z => isLuniSauVineri(z))
    for (const item of deSchedulat.filter(x => x.isElm)) {
      const areInSapt = (deja[item.apt.nr] || []).some(d => d >= luniStr && d <= vineriStr)
      if (areInSapt && !item.fromNota) { skipped++; continue }
      const ziGasita = gasesteCeaMaiLibera(elmZile)
      if (!ziGasita) { skipped++; continue }
      slot[ziGasita]++
      deProgramat.push({
        data_programata: ziGasita, nr_apt: item.apt.nr,
        tip_apt: item.apt.tip || 'simplu', firma: item.apt.firma || '',
        tip_curatenie: 'intretinere', status_curatenie: 'programata',
        observatii: 'Auto-generat (ELM)', amanare_status: ''
      })
      programate++
    }

    // Restul - distributie uniforma
    const urgent = deSchedulat.filter(x => !x.isElm && x.urgenta)
    const normal = deSchedulat.filter(x => !x.isElm && !x.urgenta)
    normal.sort((a, b) => a.targetDate - b.targetDate)

    for (const item of [...urgent, ...normal]) {
      const areInSapt = (deja[item.apt.nr] || []).some(d => d >= luniStr && d <= vineriStr)
      if (areInSapt && !item.fromNota) { skipped++; continue }
      const ziGasita = gasesteCeaMaiLibera(zile)
      if (!ziGasita) { skipped++; continue }
      slot[ziGasita]++
      deProgramat.push({
        data_programata: ziGasita, nr_apt: item.apt.nr,
        tip_apt: item.apt.tip || 'simplu', firma: item.apt.firma || '',
        tip_curatenie: 'intretinere', status_curatenie: 'programata',
        observatii: item.urgenta ? 'Auto-generat (urgent)' : item.fromNota ? `Auto-generat (${item.apt.nota})` : 'Auto-generat',
        amanare_status: ''
      })
      programate++
    }

    if (deProgramat.length > 0) {
      const { error } = await supabase.from('curatenie').insert(deProgramat)
      if (error) { console.error('[AutoScheduler] Eroare:', error); return { programate: 0, skipped, error } }
      const nruri = [...new Set(deProgramat.map(c => c.nr_apt))]
      await supabase.from('apartamente').update({ curatenie_status: 'programata' }).in('nr', nruri)
      await supabase.from('log_actiuni').insert({
        user_tip: 'admin', actiune: 'Auto-programare saptamana',
        nr_apt: nruri.join(','),
        detalii: `${programate} curatenii pentru ${luniStr}-${vineriStr}`
      })
    }

    console.log(`[AutoScheduler] Programat: ${programate}, Sarit: ${skipped}`)
    return { programate, skipped, distributie: slot }
  } catch(e) {
    console.error('[AutoScheduler] Eroare:', e)
    return { programate: 0, skipped: 0, error: e.message }
  }
}

// Programeaza curatenia pe 15 ale lunii curente pentru luna viitoare
export async function programeazaLunaViitoare() {
  try {
    const azi = new Date()
    const lunaViitoare = new Date(azi.getFullYear(), azi.getMonth() + 1, 1)
    const lunaVStr = lunaViitoare.getFullYear() + '-' + String(lunaViitoare.getMonth()+1).padStart(2,'0')

    const { data: apts } = await supabase.from('apartamente').select('*').in('status', ['activ', 'elib'])
    if (!apts?.length) return { programate: 0 }

    let programate = 0
    const deProgramat = []

    for (const apt of apts) {
      const frecventa = parseazaNota(apt.nota)
      if (!frecventa) continue

      // Verifica cate sunt deja programate luna viitoare
      const { data: existente } = await supabase.from('curatenie').select('id')
        .eq('nr_apt', apt.nr)
        .gte('data_programata', lunaVStr + '-01')
        .lte('data_programata', lunaVStr + '-31')

      const nrExistente = existente?.length || 0
      const targetNr = frecventa.tip === 's' ? frecventa.nr * 4 : frecventa.nr
      const ramas = targetNr - nrExistente
      if (ramas <= 0) continue

      // Distribuie uniform in luna viitoare
      const zileleLunii = new Date(lunaViitoare.getFullYear(), lunaViitoare.getMonth() + 1, 0).getDate()
      const interval = Math.floor(zileleLunii / targetNr)

      for (let i = 0; i < ramas; i++) {
        const zi = Math.min(1 + (nrExistente + i) * interval, zileleLunii)
        const dataStr = lunaVStr + '-' + String(zi).padStart(2, '0')
        // Skip weekends
        const dow = new Date(dataStr).getDay()
        const dataFinal = dow === 0 ? lunaVStr + '-' + String(Math.min(zi+1, zileleLunii)).padStart(2,'0') :
                          dow === 6 ? lunaVStr + '-' + String(Math.max(zi-1, 1)).padStart(2,'0') : dataStr

        const isElm = isELM(apt.firma)
        if (isElm) {
          // ELM doar luni sau vineri - gaseste cea mai apropiata
          const d = new Date(dataFinal)
          while (d.getDay() !== 1 && d.getDay() !== 5) d.setDate(d.getDate() + 1)
          deProgramat.push({ data_programata: dateStr(d), nr_apt: apt.nr, tip_apt: apt.tip||'simplu', firma: apt.firma||'', tip_curatenie:'intretinere', status_curatenie:'programata', observatii:`Auto ${lunaVStr} (${apt.nota})`, amanare_status:'' })
        } else {
          deProgramat.push({ data_programata: dataFinal, nr_apt: apt.nr, tip_apt: apt.tip||'simplu', firma: apt.firma||'', tip_curatenie:'intretinere', status_curatenie:'programata', observatii:`Auto ${lunaVStr} (${apt.nota})`, amanare_status:'' })
        }
        programate++
      }
    }

    if (deProgramat.length > 0) {
      await supabase.from('curatenie').insert(deProgramat)
      await supabase.from('log_actiuni').insert({
        user_tip: 'admin', actiune: 'Auto-programare luna viitoare',
        detalii: `${programate} curatenii pentru ${lunaVStr}`
      })
    }
    return { programate }
  } catch(e) { console.error('[Scheduler luna]', e); return { programate: 0 } }
}

export async function checkSiRuleazaVineri() {
  const azi = new Date()
  const aziStr = azi.getFullYear() + '-' + String(azi.getMonth()+1).padStart(2,'0') + '-' + String(azi.getDate()).padStart(2,'0')

  // Ruleaza zilnic pentru programarea lunii viitoare (dupa 15 ale lunii)
  if (azi.getDate() >= 15) {
    const { data: logLuna } = await supabase.from('log_actiuni').select('id')
      .eq('actiune', 'Auto-programare luna viitoare')
      .gte('created_at', aziStr + 'T00:00:00').limit(1)
    if (!logLuna || logLuna.length === 0) {
      programeazaLunaViitoare()
    }
  }

  // Ruleaza saptamanal vineri
  if (azi.getDay() !== 5) return null
  const { data: log } = await supabase.from('log_actiuni').select('id')
    .eq('actiune', 'Auto-programare saptamana').gte('created_at', aziStr + 'T00:00:00').limit(1)
  if (log && log.length > 0) return null
  return genereazaSaptamana()
}
