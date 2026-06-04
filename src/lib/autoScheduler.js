import { supabase } from './supabase'
import {
  getSetariZile,
  isZiLucratoare,
  urmatoareaZiLucratoare as urmZiLucr,
  ziLucratoareInainte,
} from './zileLucratoare'

const MAX_PER_ZI = 12        // plafon SOFT (depășibil pentru generale și cadență 10 zile)
const CADENTA_MAX = 10       // interval maxim între curățenii (zile)
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

// Wrapper: următoarea zi lucrătoare folosind setările (weekend + sărbători + override).
function urmatoareaZiLucratoare(d, setari) {
  return urmZiLucr(d, setari)
}

// Cea mai apropiata zi luni sau vineri - cauta in ambele directii
function celMaiApropiataLuniSauVineri(d) {
  const r = new Date(d)
  r.setHours(0,0,0,0)
  const zi = r.getDay()

  // Daca e deja luni sau vineri, ramane
  if (zi === 1 || zi === 5) return r

  // Cauta in viitor
  let viitor = new Date(r)
  while (viitor.getDay() !== 1 && viitor.getDay() !== 5) viitor.setDate(viitor.getDate() + 1)

  // Cauta in trecut
  let trecut = new Date(r)
  while (trecut.getDay() !== 1 && trecut.getDay() !== 5) trecut.setDate(trecut.getDate() - 1)

  // Returneaza cel mai apropiat - preferinta pentru viitor la distante egale
  const diffViitor = Math.abs(diffZile(r, viitor))
  const diffTrecut = Math.abs(diffZile(trecut, r))

  return diffViitor <= diffTrecut ? viitor : trecut
}

function isELM(firma) {
  if (!firma) return false
  return ELM_FIRME.some(f => firma.toLowerCase().includes(f))
}

// Apartamentul are deja o curatenie pe data ceruta sau la <= prag zile distanta?
// prag = 1 -> aceeasi zi sau zi consecutiva (evita 2 zile la rand).
function areCuratenieAproape(programateViitor, nr, dataStr, prag) {
  const d = parseDate(dataStr)
  if (!d) return false
  return (programateViitor[nr] || []).some(x => {
    const xd = parseDate(x)
    return xd && Math.abs(diffZile(xd, d)) <= prag
  })
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
    const setari = await getSetariZile(true)
    const azi = new Date(); azi.setHours(0,0,0,0)
    const aziStr = dateStr(azi)

    // Saptamana viitoare: luni -> duminica
    const ziAzi = azi.getDay()
    const paneLuni = ziAzi === 0 ? 1 : (8 - ziAzi)
    const luni = addZile(azi, paneLuni)
    const duminica = addZile(luni, 6)
    const luniStr = dateStr(luni)
    const dumStr = dateStr(duminica)

    // Zilele LUCRATOARE din saptamana viitoare (respecta weekend on/off + sarbatori + override)
    const zileLucr = []
    for (let i = 0; i < 7; i++) {
      const d = addZile(luni, i)
      if (isZiLucratoare(d, setari)) zileLucr.push(d)
    }
    if (!zileLucr.length) {
      console.log('[Scheduler] Saptamana viitoare nu are zile lucratoare')
      return { programate: 0, skipped: 0 }
    }
    const ultimaLucr = zileLucr[zileLucr.length - 1]

    console.log(`[Scheduler] Generez ${luniStr} - ${dumStr} (${zileLucr.length} zile lucratoare)`)

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

    // Contorizare per zi LUCRATOARE din saptamana viitoare
    const slot = {}
    zileLucr.forEach(d => { slot[dateStr(d)] = 0 })
    // Adauga curateniile deja existente in saptamana viitoare
    ;(existente || []).forEach(c => {
      if (c.data_programata >= luniStr && c.data_programata <= dumStr) {
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

      // Doar daca elibereaza in saptamana viitoare (generala se pune pe data elib chiar daca e weekend/sarbatoare)
      if (apt.data_elib < luniStr || apt.data_elib > dumStr) continue

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
    const primaLucr = zileLucr[0]

    for (const apt of apts) {
      // Baza de calcul: ultima curatenie finalizata sau data check-in
      const ultimaFacuta = ultimaCuratenie[apt.nr]
        ? parseDate(ultimaCuratenie[apt.nr])
        : apt.data_checkin
          ? parseDate(apt.data_checkin)
          : null

      if (!ultimaFacuta) continue

      // Termen limita cadenta: ultima + 10 zile (nu se incalca niciodata)
      const maxData = addZile(ultimaFacuta, CADENTA_MAX)

      // Calculeaza urmatoarea curatenie: ultima + 7 zile -> zi lucratoare
      let urmatoarea = urmatoareaZiLucratoare(addZile(ultimaFacuta, 7), setari)

      // Daca urmatoarea e inainte de saptamana viitoare -> prima zi lucratoare a saptamanii
      if (urmatoarea < primaLucr) urmatoarea = primaLucr

      // NU programa intretinere dupa ce clientul pleaca (data eliberarii).
      // Generala la check-out e deja pusa in STEP 1.
      if (apt.data_elib && apt.data_elib >= aziStr && dateStr(urmatoarea) >= apt.data_elib) { skipped++; continue }

      // Verifica daca are deja curatenie programata in intervalul valid (7-10 zile, cadenta)
      const areInInterval = (programateViitor[apt.nr] || []).some(d => {
        const diff = diffZile(ultimaFacuta, parseDate(d))
        return diff >= 7 && diff <= CADENTA_MAX
      })
      if (areInInterval) { skipped++; continue }

      // Verifica daca urmatoarea e in saptamana viitoare
      if (urmatoarea < primaLucr || urmatoarea > ultimaLucr) { skipped++; continue }

      const zileDeLaUltima = diffZile(ultimaFacuta, azi)
      const urgent = zileDeLaUltima >= 9 // aproape de ziua 10
      // Obligatorie daca termenul de cadenta (10 zile) cade in/inaintea saptamanii viitoare
      const obligatoriu = maxData <= ultimaLucr

      deSchedulat.push({
        apt,
        targetDate: urmatoarea,
        maxData,
        urgent,
        obligatoriu,
        isElm: isELM(apt.firma),
        zileDeLaUltima
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
      const nr = item.apt.nr
      let dataFinala = null

      if (item.isElm) {
        // ELM: O SINGURA curatenie/saptamana, luni SAU vineri (cea mai apropiata de target),
        // fara zi consecutiva cu alta curatenie a apartamentului. ELM depaseste plafonul.
        const candidati = [luni, addZile(luni, 4)]
          .map(z => urmatoareaZiLucratoare(z, setari))
          .filter(z => z <= ultimaLucr)
          .filter(z => !areCuratenieAproape(programateViitor, nr, dateStr(z), 1))
        let bestElm = null, bestDiff = Infinity
        for (const z of candidati) {
          const diff = Math.abs(diffZile(item.targetDate, z))
          if (diff < bestDiff) { bestDiff = diff; bestElm = z }
        }
        if (!bestElm) { skipped++; continue }
        dataFinala = dateStr(bestElm)
      } else {
        // Normal: targetDate (sub plafon, fara zi consecutiva), altfel ziua libera fara consecutive.
        const targetStr = dateStr(item.targetDate)

        if (slot[targetStr] !== undefined && slot[targetStr] < MAX_PER_ZI
            && !areCuratenieAproape(programateViitor, nr, targetStr, 1)) {
          dataFinala = targetStr
        } else {
          // Cauta ziua lucratoare cea mai libera, sub plafon, FARA zile consecutive.
          let minSlot = Infinity
          for (const d of Object.keys(slot)) {
            if (slot[d] < MAX_PER_ZI && slot[d] < minSlot
                && !areCuratenieAproape(programateViitor, nr, d, 1)) { minSlot = slot[d]; dataFinala = d }
          }
          if (!dataFinala && item.obligatoriu) {
            // PLAFON SOFT: cadenta de 10 zile obliga. Alege o zi fara conflict de zile
            // consecutive, de preferat <= maxData; altfel cea mai libera fara conflict.
            let bestN = Infinity
            for (const d of Object.keys(slot)) {
              if (parseDate(d) <= item.maxData
                  && !areCuratenieAproape(programateViitor, nr, d, 1) && slot[d] < bestN) { bestN = slot[d]; dataFinala = d }
            }
            if (!dataFinala) {
              for (const d of Object.keys(slot)) {
                if (!areCuratenieAproape(programateViitor, nr, d, 1) && slot[d] < bestN) { bestN = slot[d]; dataFinala = d }
              }
            }
          }
          if (!dataFinala) { skipped++; continue }
        }
      }

      if (slot[dataFinala] !== undefined) slot[dataFinala]++
      if (!programateViitor[nr]) programateViitor[nr] = []
      programateViitor[nr].push(dataFinala)
      deProgramat.push({
        data_programata: dataFinala,
        nr_apt: nr,
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
        detalii: `${programate} curatenii pentru ${luniStr}-${dumStr}`
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
    const setari = await getSetariZile(true)
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
      let cursor = urmatoareaZiLucratoare(addZile(baza, 7), setari)

      // Daca cursor e inainte de luna viitoare, avanseaza
      while (cursor < lunaViitoare) cursor = urmatoareaZiLucratoare(addZile(cursor, 7), setari)

      for (let i = 0; i < ramas; i++) {
        if (cursor > new Date(lunaViitoare.getFullYear(), lunaViitoare.getMonth() + 1, 0)) break

        const dataStr2 = dateStr(cursor)

        // ELM: ajusteaza la luni/vineri (zi lucratoare)
        let dataFinala = dataStr2
        if (isELM(apt.firma)) {
          const adjusted = celMaiApropiataLuniSauVineri(cursor)
          dataFinala = dateStr(urmatoareaZiLucratoare(adjusted, setari))
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
        cursor = urmatoareaZiLucratoare(addZile(cursor, 7), setari)
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

// ── Check si ruleaza (generare automata JOI la 10:00) ─────────
export async function checkSiRuleazaJoi() {
  const azi = new Date()
  const aziStr = dateStr(azi)

  // Dupa 15 ale lunii -> programeaza luna viitoare (o singura data pe zi)
  if (azi.getDate() >= 15) {
    const { data: logLuna } = await supabase.from('log_actiuni').select('id')
      .eq('actiune', 'Auto-programare luna viitoare')
      .gte('created_at', aziStr + 'T00:00:00').limit(1)
    if (!logLuna?.length) programeazaLunaViitoare()
  }

  // Doar JOI, de la ora 10:00 -> programeaza saptamana viitoare
  if (azi.getDay() !== 4) return null
  if (azi.getHours() < 10) return null

  const { data: log } = await supabase.from('log_actiuni').select('id')
    .eq('actiune', 'Auto-programare saptamana')
    .gte('created_at', aziStr + 'T00:00:00').limit(1)
  if (log?.length > 0) return null

  return genereazaSaptamana()
}

// Compatibilitate inapoi (vechiul nume) — ruleaza acum joi la 10:00.
export const checkSiRuleazaVineri = checkSiRuleazaJoi

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
