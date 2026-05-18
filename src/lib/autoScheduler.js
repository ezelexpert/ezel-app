import { supabase } from './supabase'

const MAX_PER_ZI = 12
const ZILE_IDEAL = 7
const ZILE_MAX = 10
const ELM_FIRME = ['elm', 'electromontaj']

function isELM(firma) {
  if (!firma) return false
  return ELM_FIRME.some(f => firma.toLowerCase().includes(f))
}

// Returneaza data in format yyyy-mm-dd
function dateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

// Adauga zile la o data
function addZile(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// Diferenta in zile intre doua date
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

// Verifica daca e luni sau vineri (pentru ELM)
function isLuniSauVineri(d) {
  const zi = d.getDay()
  return zi === 1 || zi === 5
}

// Genereaza lista de zile lucratoare dintr-o saptamana (luni-vineri)
function zileSaptamana(luni) {
  const zile = []
  for (let i = 0; i < 5; i++) {
    zile.push(addZile(luni, i))
  }
  return zile
}

// Gaseste luni dintr-o saptamana data (saptamana viitoare fata de azi)
function luniSaptamanaViitoare() {
  const azi = new Date()
  azi.setHours(0,0,0,0)
  const ziAzi = azi.getDay() // 0=dum, 1=lun, ..., 5=vin, 6=sam
  // Zile pana la luni viitoare
  const paneLuni = ziAzi === 0 ? 1 : (8 - ziAzi)
  return addZile(azi, paneLuni)
}

export async function genereazaSaptamana() {
  try {
    const luni = luniSaptamanaViitoare()
    const vineri = addZile(luni, 4)
    const luniStr = dateStr(luni)
    const vineriStr = dateStr(vineri)
    const azi = new Date(); azi.setHours(0,0,0,0)

    console.log(`[AutoScheduler] Generez saptamana ${luniStr} - ${vineriStr}`)

    // 1. Ia toate apartamentele ocupate
    const { data: apts } = await supabase
      .from('apartamente')
      .select('*')
      .in('status', ['activ', 'elib'])

    if (!apts || apts.length === 0) return { programate: 0, skipped: 0 }

    // 2. Ia toate curateniile existente (pentru a nu duplica)
    const { data: existente } = await supabase
      .from('curatenie')
      .select('*')
      .gte('data_programata', dateStr(azi))
      .neq('status_curatenie', 'finalizata')

    // Map: nr_apt -> lista date deja programate
    const deja = {}
    ;(existente || []).forEach(c => {
      if (!deja[c.nr_apt]) deja[c.nr_apt] = []
      deja[c.nr_apt].push(c.data_programata)
    })

    // 3. Calculeaza pentru fiecare apartament cand trebuie curatenie
    const deSchedulat = [] // { apt, targetDate, urgenta, isElm }

    for (const apt of apts) {
      // Gaseste ultima curatenie finalizata
      const { data: ultimele } = await supabase
        .from('curatenie')
        .select('data_programata, data_finalizare')
        .eq('nr_apt', apt.nr)
        .eq('status_curatenie', 'finalizata')
        .order('data_programata', { ascending: false })
        .limit(1)

      const ultimaData = ultimele?.[0]?.data_programata
        ? new Date(ultimele[0].data_programata)
        : apt.updated_at
          ? new Date(apt.updated_at)
          : new Date(azi)

      ultimaData.setHours(0,0,0,0)

      const zileTrecute = diffZile(ultimaData, azi)
      const zileRamase = ZILE_IDEAL - zileTrecute
      const zileMaxRamase = ZILE_MAX - zileTrecute

      // Daca are deja curatenie viitoare programata, verifica daca e in termen
      const dateViitoare = (deja[apt.nr] || []).filter(d => d >= dateStr(azi))
      if (dateViitoare.length > 0) {
        // Are deja programata - verifica daca e in termenul de 10 zile
        const ceaMaiApropiata = dateViitoare.sort()[0]
        const zileParaCea = diffZile(azi, ceaMaiApropiata)
        if (zileTrecute + zileParaCea <= ZILE_MAX) {
          continue // OK, nu trebuie reprogramat
        }
        // Altfel cade in afara termenului - adauga urgent
      }

      // Calculeaza ziua tinta in saptamana viitoare
      let targetOffset = Math.max(0, zileRamase) // zile pana la ideal
      let urgenta = false

      if (zileMaxRamase <= 5) {
        // Mai sunt max 5 zile pana la deadline - urgent, programeaza cat mai repede
        urgenta = true
        targetOffset = 0
      }

      const targetDate = addZile(azi, Math.max(targetOffset, 0))

      deSchedulat.push({
        apt,
        targetDate,
        urgenta,
        isElm: isELM(apt.firma),
        zileTrecute
      })
    }

    if (deSchedulat.length === 0) {
      console.log('[AutoScheduler] Nimic de programat')
      return { programate: 0, skipped: 0 }
    }

    // 4. Sortare: urgente primul, apoi ELM, apoi dupa zile trecute
    deSchedulat.sort((a, b) => {
      if (a.urgenta !== b.urgenta) return b.urgenta - a.urgenta
      if (a.isElm !== b.isElm) return b.isElm - a.isElm
      return b.zileTrecute - a.zileTrecute
    })

    // 5. Distribuie pe zile respectand max 12/zi si regulile ELM
    const zile = zileSaptamana(luni)
    const slot = {} // dateStr -> count
    zile.forEach(z => { slot[dateStr(z)] = 0 })

    // Adauga si curateniile deja existente in saptamana viitoare la numarator
    ;(existente || []).forEach(c => {
      if (c.data_programata >= luniStr && c.data_programata <= vineriStr) {
        if (slot[c.data_programata] !== undefined) {
          slot[c.data_programata]++
        }
      }
    })

    const deProgramat = [] // { nr_apt, data, tip_apt, firma, tip_curatenie }
    let programate = 0, skipped = 0

    for (const item of deSchedulat) {
      const apt = item.apt

      // Verifica daca are deja curatenie in saptamana viitoare
      const areInSapt = (deja[apt.nr] || []).some(d => d >= luniStr && d <= vineriStr)
      if (areInSapt) { skipped++; continue }

      // Gaseste ziua potrivita
      let ziGasita = null

      if (item.isElm) {
        // ELM: doar luni sau vineri
        const elmZile = zile.filter(z => isLuniSauVineri(z))
        for (const z of elmZile) {
          const ds = dateStr(z)
          if (slot[ds] < MAX_PER_ZI) {
            ziGasita = ds; break
          }
        }
      } else {
        // Celelalte: incearca de la targetDate spre vineri
        const sortedZile = [...zile].sort((a, b) => {
          const da = Math.abs(diffZile(item.targetDate, a))
          const db = Math.abs(diffZile(item.targetDate, b))
          return da - db
        })
        for (const z of sortedZile) {
          const ds = dateStr(z)
          if (slot[ds] < MAX_PER_ZI) {
            ziGasita = ds; break
          }
        }
      }

      if (!ziGasita) { skipped++; continue }

      slot[ziGasita]++
      deProgramat.push({
        data_programata: ziGasita,
        nr_apt: apt.nr,
        tip_apt: apt.tip || 'simplu',
        firma: apt.firma || '',
        tip_curatenie: 'intretinere',
        status_curatenie: 'programata',
        observatii: 'Auto-generat vineri',
        amanare_status: ''
      })
      programate++
    }

    // 6. Insereaza in Supabase
    if (deProgramat.length > 0) {
      const { error } = await supabase.from('curatenie').insert(deProgramat)
      if (error) {
        console.error('[AutoScheduler] Eroare insert:', error)
        return { programate: 0, skipped, error }
      }

      // Update curatenie_status pe apartamente
      const nruri = [...new Set(deProgramat.map(c => c.nr_apt))]
      await supabase.from('apartamente')
        .update({ curatenie_status: 'programata' })
        .in('nr', nruri)

      // Log
      await supabase.from('log_actiuni').insert({
        user_tip: 'admin',
        actiune: 'Auto-programare saptamana',
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

// Verifica daca azi e vineri si nu s-a mai rulat azi
export async function checkSiRuleazaVineri() {
  const azi = new Date()
  const ziSapt = azi.getDay() // 5 = vineri
  if (ziSapt !== 5) return null

  // Verifica daca s-a rulat deja azi
  const aziStr = azi.getFullYear() + '-' +
    String(azi.getMonth() + 1).padStart(2, '0') + '-' +
    String(azi.getDate()).padStart(2, '0')

  const { data: log } = await supabase
    .from('log_actiuni')
    .select('id')
    .eq('actiune', 'Auto-programare saptamana')
    .gte('created_at', aziStr + 'T00:00:00')
    .limit(1)

  if (log && log.length > 0) {
    console.log('[AutoScheduler] Deja rulat azi')
    return null
  }

  return genereazaSaptamana()
}
