import { supabase } from './supabase'

const MAX_PER_ZI = 12
const ELM_FIRME = ['elm', 'electromontaj']

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

// Verifica daca e zi lucratoare (luni-vineri)
function isLucratoare(d) {
  const zi = d.getDay()
  return zi >= 1 && zi <= 5
}

// Returneaza urmatoarea zi lucratoare (inclusiv ziua data daca e lucratoare)
function urmatoareaZiLucratoare(d) {
  const r = new Date(d)
  r.setHours(0,0,0,0)
  while (!isLucratoare(r)) r.setDate(r.getDate() + 1)
  return r
}

// Cea mai apropiata zi luni sau vineri
function celMaiApropiataLuniSauVineri(d) {
  const r = new Date(d)
  r.setHours(0,0,0,0)
  const zi = r.getDay()
  // Distante pana la luni (1) si vineri (5)
  const paneLuni = zi <= 1 ? 1 - zi : 8 - zi
  const paneVineri = zi <= 5 ? 5 - zi : 12 - zi
  if (paneLuni <= paneVineri) {
    return addZile(r, paneLuni)
  } else {
    return addZile(r, paneVineri)
  }
}

function isELM(firma) {
  if (!firma) return false
  return ELM_FIRME.some(f => firma.toLowerCase().includes(f))
}

// Parseaza nota c/l: "2c/l", "1c/l", "2 C/L" etc
function parseazaNota(nota) {
  if (!nota) return null
  const normalized = nota.toLowerCase().replace(/\s/g, '')
  const match = normalized.match(/(\d+)c\/?l/)
  if (!match) return null
  const nr = parseInt(match[1])
  return isNaN(nr) || nr <= 0 ? null : nr // nr curatenii pe luna
}

// ── Functia principala ────────────────────────────────────────
export async function genereazaSaptamana() {
  try {
    const azi = new Date(); azi.setHours(0,0,0,0)
    const aziStr = dateStr(azi)

    // Saptamana viitoare luni-vineri
    const ziAzi = azi.getDay()
    const paneLuni = ziAzi === 0 ? 1 : (8 - ziAzi)
    const luni = addZile(azi, paneLuni)
    const vineri = addZile(luni, 4)
    const luniStr = dateStr(luni)
    const vineriStr = dateStr(vineri)

    console.log(`[Scheduler] Generez ${luniStr} - ${vineriStr}`)

    // Ia toate apartamentele ocupate sau care elibereaza
    const { data: apts } = await supabase
      .from('apartamente')
      .select('*')
      .in('status', ['activ', 'elib'])

    if (!apts?.length) return { programate: 0, skipped: 0 }

    // Ia toate curateniile existente viitoare (neprogramate/programate)
    const { data: existente } = await supabase
      .from('curatenie')
      .select('*')
      .gte('data_programata', aziStr)
      .neq('status_curatenie', 'finalizata')

    // Contorizare per zi pentru saptamana viitoare
    const slot = {}
    for (let i = 0; i < 5; i++) {
      slot[dateStr(addZile(luni, i))] = 0
    }
    // Adauga curateniile deja existente in saptamana viitoare
    ;(existente || []).forEach(c => {
      if (c.data_programata >= luniStr && c.data_programata <= vineriStr) {
        if (slot[c.data_programata] !== undefined) slot[c.data_programata]++
      }
    })

    // Map: nr_apt -> ultima curatenie finalizata
    const ultimaCuratenie = {}
    const { data: finalizate } = await supabase
      .from('curatenie')
      .select('nr_apt, data_programata')
      .eq('status_curatenie', 'finalizata')
      .order('data_programata', { ascending: false })

    ;(finalizate || []).forEach(c => {
      if (!ultimaCuratenie[c.nr_apt]) ultimaCuratenie[c.nr_apt] = c.data_programata
    })

    // Map: nr_apt -> curatenii deja programate viitoare
    const programateViitor = {}
    ;(existente || []).forEach(c => {
      if (!programateViitor[c.nr_apt]) programateViitor[c.nr_apt] = []
      programateViitor[c.nr_apt].push(c.data_programata)
    })

    const deProgramat = []
    let programate = 0, skipped = 0

    // ── STEP 1: Curățenii generale (apartamente care elibereaza) ──
    // Prioritate maxima - se pun fix pe data eliberarii, ignora limita
    for (const apt of apts.filter(a => a.status === 'elib' && a.data_elib)) {
      const dataElib = parseDate(apt.data_elib)
      if (!dataElib) continue

      // Doar daca elibereaza in saptamana viitoare
      if (apt.data_elib < luniStr || apt.data_elib > vineriStr) continue

      // Verifica daca nu are deja curatenie generala programata
      const areGenerala = (programateViitor[apt.nr] || []).some(d => d === apt.data_elib)
      if (areGenerala) continue

      // Pune curatenie generala pe data eliberarii - fara limita
      deProgramat.push({
        data_programata: apt.data_elib,
        nr_apt: apt.nr,
        tip_apt: apt.tip || 'simplu',
        firma: apt.firma || '',
        tip_curatenie: 'generala',
        status_curatenie: 'programata',
        observatii: 'Auto - eliberare client',
        amanare_status: ''
      })
      if (slot[apt.data_elib] !== undefined) slot[apt.data_elib]++
      if (!programateViitor[apt.nr]) programateViitor[apt.nr] = []
      programateViitor[apt.nr].push(apt.data_elib)
      programate++
    }

    // ── STEP 2: Calculeaza urmatoarea curatenie pentru fiecare apt ──
    const deSchedulat = []

    for (const apt of apts) {
      // Baza de calcul: ultima curatenie finalizata sau data check-in
      const ultimaFacuta = ultimaCuratenie[apt.nr]
        ? parseDate(ultimaCuratenie[apt.nr])
        : apt.data_checkin
          ? parseDate(apt.data_checkin)
          : null

      if (!ultimaFacuta) continue

      // Calculeaza urmatoarea curatenie: ultima + 7 zile -> zi lucratoare
      let urmatoarea = urmatoareaZiLucratoare(addZile(ultimaFacuta, 7))

      // Daca urmatoarea e in trecut -> prima zi lucratoare disponibila din saptamana viitoare
      if (urmatoarea < luni) {
        // Cat de tarziu suntem? Daca depaseste 10 zile -> urgent
        const zileIntarziere = diffZile(urmatoarea, azi)
        if (zileIntarziere > 3) {
          urmatoarea = luni // Urgent - prima zi a saptamanii viitoare
        } else {
          urmatoarea = urmatoareaZiLucratoare(addZile(ultimaFacuta, 7))
          if (urmatoarea < luni) urmatoarea = luni
        }
      }

      // Verifica daca are deja curatenie programata in intervalul valid (7-10 zile)
      const areInInterval = (programateViitor[apt.nr] || []).some(d => {
        const diff = diffZile(ultimaFacuta, parseDate(d))
        return diff >= 7 && diff <= 14
      })
      if (areInInterval) { skipped++; continue }

      // Verifica daca urmatoarea e in saptamana viitoare
      if (urmatoarea < luni || urmatoarea > vineri) { skipped++; continue }

      const nota = parseazaNota(apt.nota)
      const urgent = diffZile(ultimaFacuta, azi) >= 9 // aproape de ziua 10

      deSchedulat.push({
        apt,
        targetDate: urmatoarea,
        urgent,
        isElm: isELM(apt.firma),
        zileDeLaUltima: diffZile(ultimaFacuta, azi)
      })
    }

    // ── STEP 3: Sorteaza si distribuie ──
    // Ordine: urgent > ELM > normal, in interiorul fiecarei categorii dupa targetDate
    deSchedulat.sort((a, b) => {
      if (a.urgent !== b.urgent) return b.urgent - a.urgent
      if (a.isElm !== b.isElm) return b.isElm - a.isElm
      return a.targetDate - b.targetDate
    })

    for (const item of deSchedulat) {
      let dataFinala

      if (item.isElm) {
        // ELM: luni sau vineri cea mai apropiata de targetDate
        const ziElm = celMaiApropiataLuniSauVineri(item.targetDate)
        // Asigura ca e in saptamana viitoare
        if (ziElm < luni) {
          dataFinala = dateStr(luni) // luni saptamana viitoare
          // Verifica daca luni e luni sau vineri
          if (luni.getDay() !== 1) dataFinala = dateStr(vineri)
        } else if (ziElm > vineri) {
          skipped++; continue
        } else {
          dataFinala = dateStr(ziElm)
        }
        // ELM depaseste limita
      } else {
        // Normal: incearca targetDate, daca e plina gaseste cea mai libera zi
        const targetStr = dateStr(item.targetDate)

        if (slot[targetStr] !== undefined && slot[targetStr] < MAX_PER_ZI) {
          dataFinala = targetStr
        } else {
          // Gaseste ziua cea mai libera din saptamana viitoare
          let minSlot = Infinity, ziGasita = null
          for (let i = 0; i < 5; i++) {
            const d = dateStr(addZile(luni, i))
            if (slot[d] < MAX_PER_ZI && slot[d] < minSlot) {
              minSlot = slot[d]
              ziGasita = d
            }
          }
          if (!ziGasita) { skipped++; continue }
          dataFinala = ziGasita
        }
      }

      if (slot[dataFinala] !== undefined) slot[dataFinala]++
      deProgramat.push({
        data_programata: dataFinala,
        nr_apt: item.apt.nr,
        tip_apt: item.apt.tip || 'simplu',
        firma: item.apt.firma || '',
        tip_curatenie: 'intretinere',
        status_curatenie: 'programata',
        observatii: item.urgent ? 'Auto (urgent)' : item.isElm ? 'Auto (ELM)' : 'Auto',
        amanare_status: ''
      })
      programate++
    }

    // ── STEP 4: Salveaza in Supabase ──
    if (deProgramat.length > 0) {
      const { error } = await supabase.from('curatenie').insert(deProgramat)
      if (error) { console.error('[Scheduler] Eroare insert:', error); return { programate: 0, skipped, error } }

      // Update curatenie_status
      const nruri = [...new Set(deProgramat.map(c => c.nr_apt))]
      await supabase.from('apartamente').update({ curatenie_status: 'programata' }).in('nr', nruri)

      // Log
      await supabase.from('log_actiuni').insert({
        user_tip: 'admin',
        actiune: 'Auto-programare saptamana',
        detalii: `${programate} curatenii pentru ${luniStr}-${vineriStr}`
      })
    }

    console.log(`[Scheduler] Programat: ${programate}, Sarit: ${skipped}`)
    console.log('[Scheduler] Distributie:', slot)
    return { programate, skipped, distributie: slot }

  } catch(e) {
    console.error('[Scheduler] Eroare:', e)
    return { programate: 0, skipped: 0, error: e.message }
  }
}

// ── Programare luna viitoare (dupa 15 ale lunii) ─────────────
export async function programeazaLunaViitoare() {
  try {
    const azi = new Date(); azi.setHours(0,0,0,0)
    const lunaViitoare = new Date(azi.getFullYear(), azi.getMonth() + 1, 1)
    const lunaVStr = lunaViitoare.getFullYear() + '-' + String(lunaViitoare.getMonth()+1).padStart(2,'0')
    const ultimaZiLuna = new Date(lunaViitoare.getFullYear(), lunaViitoare.getMonth() + 1, 0).getDate()

    const { data: apts } = await supabase.from('apartamente').select('*').in('status', ['activ', 'elib'])
    if (!apts?.length) return { programate: 0 }

    // Ia curateniile deja existente luna viitoare
    const { data: existente } = await supabase.from('curatenie').select('*')
      .gte('data_programata', `${lunaVStr}-01`)
      .lte('data_programata', `${lunaVStr}-${ultimaZiLuna}`)

    const existentePerApt = {}
    ;(existente || []).forEach(c => {
      if (!existentePerApt[c.nr_apt]) existentePerApt[c.nr_apt] = []
      existentePerApt[c.nr_apt].push(c.data_programata)
    })

    // Ia ultima curatenie finalizata per apartament
    const { data: finalizate } = await supabase.from('curatenie').select('nr_apt, data_programata')
      .eq('status_curatenie', 'finalizata').order('data_programata', { ascending: false })

    const ultimaCuratenie = {}
    ;(finalizate || []).forEach(c => {
      if (!ultimaCuratenie[c.nr_apt]) ultimaCuratenie[c.nr_apt] = c.data_programata
    })

    const deProgramat = []
    let programate = 0

    for (const apt of apts) {
      const nrPerLuna = parseazaNota(apt.nota)
      if (!nrPerLuna) continue

      // Cate are deja programate luna viitoare
      const nrExistente = (existentePerApt[apt.nr] || []).length
      const ramas = nrPerLuna - nrExistente
      if (ramas <= 0) continue

      // Baza de calcul: ultima curatenie sau check-in
      let baza = ultimaCuratenie[apt.nr]
        ? parseDate(ultimaCuratenie[apt.nr])
        : apt.data_checkin ? parseDate(apt.data_checkin) : new Date(lunaViitoare)

      // Calculeaza datele pentru luna viitoare
      // Prima curatenie: baza + 7 zile, daca e in luna viitoare
      // Urmatoarele: fiecare la +7 zile
      let cursor = urmatoareaZiLucratoare(addZile(baza, 7))

      // Daca cursor e inainte de luna viitoare, avanseaza
      while (cursor < lunaViitoare) cursor = urmatoareaZiLucratoare(addZile(cursor, 7))

      for (let i = 0; i < ramas; i++) {
        if (cursor > new Date(lunaViitoare.getFullYear(), lunaViitoare.getMonth() + 1, 0)) break

        const dataStr2 = dateStr(cursor)

        // ELM: ajusteaza la luni/vineri
        let dataFinala = dataStr2
        if (isELM(apt.firma)) {
          const adjusted = celMaiApropiataLuniSauVineri(cursor)
          dataFinala = dateStr(adjusted)
        }

        deProgramat.push({
          data_programata: dataFinala,
          nr_apt: apt.nr,
          tip_apt: apt.tip || 'simplu',
          firma: apt.firma || '',
          tip_curatenie: 'intretinere',
          status_curatenie: 'programata',
          observatii: `Auto luna ${lunaVStr}`,
          amanare_status: ''
        })
        programate++
        cursor = urmatoareaZiLucratoare(addZile(cursor, 7))
      }
    }

    if (deProgramat.length > 0) {
      await supabase.from('curatenie').insert(deProgramat)
      await supabase.from('log_actiuni').insert({
        user_tip: 'admin',
        actiune: 'Auto-programare luna viitoare',
        detalii: `${programate} curatenii pentru ${lunaVStr}`
      })
    }

    return { programate }
  } catch(e) { console.error('[Scheduler luna]', e); return { programate: 0 } }
}

// ── Check si ruleaza ─────────────────────────────────────────
export async function checkSiRuleazaVineri() {
  const azi = new Date()
  const aziStr = dateStr(azi)

  // Dupa 15 ale lunii -> programeaza luna viitoare (o singura data pe zi)
  if (azi.getDate() >= 15) {
    const { data: logLuna } = await supabase.from('log_actiuni').select('id')
      .eq('actiune', 'Auto-programare luna viitoare')
      .gte('created_at', aziStr + 'T00:00:00').limit(1)
    if (!logLuna?.length) programeazaLunaViitoare()
  }

  // Doar vineri -> programeaza saptamana viitoare
  if (azi.getDay() !== 5) return null

  const { data: log } = await supabase.from('log_actiuni').select('id')
    .eq('actiune', 'Auto-programare saptamana')
    .gte('created_at', aziStr + 'T00:00:00').limit(1)
  if (log?.length > 0) return null

  return genereazaSaptamana()
}
