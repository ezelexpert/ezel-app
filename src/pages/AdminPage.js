import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import {
  getApartamente, updateApartament, updateApartamenteMultiple, addApartament,
  getCuratenie, programeazaCuratenie, programeazaCuratenieMultipla, marcheazaStatus, stergeCuratenie,
  getIstoric, adaugaIstoric, stergeIstoric, supabase
} from '../lib/supabase'
import Calendar from '../components/Calendar'
import Modal from '../components/Modal'
import StatisticiPage from './StatisticiPage'
import MentenantaTab from './MentenantaTab'
import AmanariTab from './AmanariTab'
import IncasariTab from './IncasariTab'
import SpalatoriePage from './SpalatoriePage'
import SalariiTab from './SalariiTab'
import PontajTab from './PontajTab'
import { checkSiRuleazaVineri, genereazaSaptamana } from '../lib/autoScheduler'
import { getNume } from '../lib/auth'

// ── Fuzzy matching firme ─────────────────────────────────────
function similaritate(a, b) {
  if (!a || !b) return 0
  const s1 = a.toLowerCase().replace(/\s/g, '')
  const s2 = b.toLowerCase().replace(/\s/g, '')
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  // Calcul litere comune
  const set1 = new Set(s1.split(''))
  const set2 = new Set(s2.split(''))
  const comune = [...set1].filter(c => set2.has(c)).length
  return comune / Math.max(set1.size, set2.size)
}

function gasesteFirmaSimilara(numeNou, firmeExistente, prag = 0.5) {
  if (!numeNou || !firmeExistente?.length) return null
  let bestMatch = null, bestScore = 0
  for (const firma of firmeExistente) {
    const score = similaritate(numeNou, firma)
    if (score > bestScore && score >= prag && firma.toLowerCase() !== numeNou.toLowerCase()) {
      bestScore = score
      bestMatch = firma
    }
  }
  return bestMatch ? { firma: bestMatch, score: bestScore } : null
}

// Navigare cu dropdown grupuri
const NAV_GROUPS = [
  { key: 'acasa', label: '🏠 Acasă', single: true, tab: 0 },
  {
    key: 'operational', label: '⚙️ Operațional',
    items: [
      { label: '📊 Statistici', tab: 5 },
      { label: '🧺 Spălătorie', tab: 8 },
      { label: '🔧 Mentenanță', tab: 6 },
      { label: '📅 Amânări', tab: 7 },
    ]
  },
  {
    key: 'date', label: '💼 Date',
    items: [
      { label: '🚪 Apartamente', tab: 1 },
      { label: '🏢 Firme', tab: 2 },
      { label: '📋 Istoric', tab: 3 },
    ]
  },
  {
    key: 'financiar', label: '💰 Financiar',
    items: [
      { label: '💰 Încasări', tab: 4 },
      { label: '💵 Salarii', tab: 9 },
      { label: '⏱ Pontaj', tab: 10 },
    ]
  },
]
const TABS = ['📅 Calendar', '🚪 Apartamente', '🏢 Firme', '📋 Istoric', '💰 Incasari', '📊 Statistici', '🔧 Mentenanta', '📅 Amanari', '🧺 Spalatorie', '💵 Salarii', '⏱ Pontaj']
const TAB_KEYS = ['calendar', 'apartamente', 'firme', 'istoric', 'incasari', 'statistici', 'mentenanta', 'amanari', 'spalatorie', 'salarii', 'pontaj']
const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const ST_MAP = { activ: ['bb','Ocupat'], elib: ['br2','Elib.'], special: ['bp2','Special'], liber: ['bg2','Liber'], maint: ['ba','Mentenanță'] }

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [apts, setApts] = useState([])
  const [curatenii, setCuratenii] = useState([])
  const [istoric, setIstoric] = useState([])
  const [loading, setLoading] = useState(true)
  const [srchApt, setSrchApt] = useState('')
  const [fltStatus, setFltStatus] = useState('')
  const [selApts, setSelApts] = useState(new Set())
  const [srchFirma, setSrchFirma] = useState('')
  const [srchIst, setSrchIst] = useState('')
  const now = new Date()
  const [calAn, setCalAn] = useState(now.getFullYear())
  const [calLuna, setCalLuna] = useState(now.getMonth())
  const [modal, setModal] = useState(null)
  const [editData, setEditData] = useState({})
  const [schedulerMsg, setSchedulerMsg] = useState(null)
  const [openDropdown, setOpenDropdown] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [a, c, i] = await Promise.all([getApartamente(), getCuratenie(), getIstoric()])
      const aziStr = new Date().toISOString().split('T')[0]
      const in5Zile = new Date(); in5Zile.setDate(in5Zile.getDate() + 5)
      const in5ZileStr = in5Zile.toISOString().split('T')[0]

      // Auto elib cu 5 zile inainte
      for (const apt of a.filter(x => x.status==='activ' && x.data_elib && x.data_elib >= aziStr && x.data_elib <= in5ZileStr)) {
        await updateApartament(apt.nr, { status: 'elib' })
        const idx = a.findIndex(x => x.nr === apt.nr); if(idx>=0) a[idx].status = 'elib'
      }

      // Auto liber daca data_elib a trecut
      const deLiberat = a.filter(apt => apt.status==='elib' && apt.data_elib && apt.data_elib < aziStr)
      if (deLiberat.length > 0) {
        const rf = { status:'liber', firma:'', nota:'', data_elib:'', pret:0, pret_utilitati:0, tip_serviciu:'cazare', utilitati_tip:'fix' }
        for (const apt of deLiberat) await updateApartament(apt.nr, rf)
        deLiberat.forEach(apt => { const idx = a.findIndex(x => x.nr===apt.nr); if(idx>=0) Object.assign(a[idx], rf) })
      }

      // In ziua eliberarii cu curatenie finalizata azi -> trece la liber
      const deTrecLaLiber = a.filter(apt =>
        apt.status === 'elib' && apt.data_elib === aziStr &&
        c.some(cur => cur.nr_apt === apt.nr && cur.status_curatenie === 'finalizata' && cur.data_programata === aziStr)
      )
      if (deTrecLaLiber.length > 0) {
        const rf = { status:'liber', firma:'', nota:'', data_elib:'', pret:0, pret_utilitati:0, tip_serviciu:'cazare', utilitati_tip:'fix' }
        for (const apt of deTrecLaLiber) await updateApartament(apt.nr, rf)
        deTrecLaLiber.forEach(apt => { const idx = a.findIndex(x => x.nr===apt.nr); if(idx>=0) Object.assign(a[idx], rf) })
      }

      setApts(a); setCuratenii(c); setIstoric(i)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
    // Ruleaza auto-scheduler vineri
    checkSiRuleazaVineri().then(result => {
      if (result && result.programate > 0) {
        setSchedulerMsg(`✅ Auto-programat ${result.programate} curățenii pentru săptămâna viitoare!`)
        setTimeout(() => setSchedulerMsg(null), 8000)
        loadAll() // Reincarca datele
      }
    }).catch(e => console.error('Scheduler error:', e))
  }, [loadAll])

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  const occ = apts.filter(a => a.status === 'activ' && a.firma).length
  const total = apts.filter(a => a.status !== 'maint').length
  const libre = apts.filter(a => a.status === 'liber').length
  const elib = apts.filter(a => a.status === 'elib').length
  const rev = apts.filter(a => a.status === 'activ' && a.pret > 0).reduce((s,a) => s + Number(a.pret) * 30, 0)

  const filteredApts = apts.filter(a =>
    (!srchApt || (a.nr + (a.firma||'') + (a.nota||'')).toLowerCase().includes(srchApt.toLowerCase())) &&
    (!fltStatus || a.status === fltStatus)
  )

  function toggleSel(nr) {
    setSelApts(prev => { const s = new Set(prev); s.has(nr) ? s.delete(nr) : s.add(nr); return s })
  }
  function clearSel() { setSelApts(new Set()) }

  async function saveEditApt() {
    const { nr, ...fields } = editData
    // Daca status = liber, reseteaza toate datele clientului
    if (fields.status === 'liber') {
      fields.firma = ''
      fields.nota = ''
      fields.data_elib = ''
      fields.pret = 0
      fields.pret_utilitati = 0
      fields.tip_serviciu = 'cazare'
      fields.utilitati_tip = 'fix'
      fields.nr_nopti = null
      fields.data_checkin = ''
      setApts(prev => prev.map(a => a.nr === nr ? { ...a, ...fields } : a))
      setModal(null)
      await updateApartament(nr, fields)
      return
    }
    if (fields.status !== 'special' && (!fields.pret || Number(fields.pret) <= 0)) { alert('Pretul este obligatoriu!'); return }
    if (!fields.tip_serviciu) fields.tip_serviciu = 'cazare'
    if (fields.tip_serviciu !== 'chirie') { fields.pret_utilitati = 0; fields.utilitati_tip = 'fix' }
    // Firma completata = Ocupat automat
    if (fields.firma && fields.firma.trim()) { fields.status = 'activ' }
    // Data eliberare = status Elibereaza automat
    if (fields.data_elib && fields.data_elib.trim()) {
      fields.status = 'elib'
    }
    // Nr nopti + checkin = calculeaza data elib automata
    if (fields.nr_nopti && fields.data_checkin) {
      const checkin = new Date(fields.data_checkin)
      checkin.setDate(checkin.getDate() + parseInt(fields.nr_nopti))
      fields.data_elib = checkin.getFullYear() + '-' + String(checkin.getMonth()+1).padStart(2,'0') + '-' + String(checkin.getDate()).padStart(2,'0')
      fields.status = 'elib'
    }
    // Salveaza firma veche in istoric daca se schimba clientul
    const aptCurent = apts.find(a => a.nr === nr)
    if (aptCurent?.firma && fields.firma && aptCurent.firma !== fields.firma) {
      const azi = new Date().toISOString().split('T')[0]
      await supabase.from('istoric_firme').insert({
        firma: aptCurent.firma,
        nr_apt: nr,
        tip_apt: aptCurent.tip || 'simplu',
        data_start: aptCurent.data_checkin || azi,
        data_end: azi,
        pret_noapte: aptCurent.pret || 0,
        nr_zile: 0,
        total_estimat: 0,
        observatii: 'Auto-salvat la schimbare client',
        pret_mediu: aptCurent.pret || 0,
        ultima_data: azi,
        nr_apartamente: 1
      })
    }

    // Fuzzy match - cauta firma similara
    if (fields.firma && fields.firma.trim()) {
      const firmeExistente = [...new Set(apts.filter(a => a.firma && a.nr !== nr).map(a => a.firma))]
      const similar = gasesteFirmaSimilara(fields.firma.trim(), firmeExistente)
      if (similar) {
        const confirmat = window.confirm(
          `Am găsit firma similară "${similar.firma}" (${Math.round(similar.score*100)}% potrivire).

Vrei să actualizez toate apartamentele cu "${similar.firma}" la noul nume "${fields.firma.trim()}"?`
        )
        if (confirmat) {
          // Foloseste numele vechi (cel deja existent in sistem)
          fields.firma = similar.firma
          const aDeActualizat = apts.filter(a => a.firma === similar.firma && a.nr !== nr).map(a => a.nr)
          if (aDeActualizat.length > 0) {
            await updateApartamenteMultiple(aDeActualizat, { firma: similar.firma })
            setApts(prev => prev.map(a => a.firma === similar.firma && a.nr !== nr ? { ...a, firma: similar.firma } : a))
          }
        }
      }
    }

    // Actualizeaza nota si prosop pentru toate apartamentele aceleiasi firme
    if (fields.firma && fields.firma.trim() && (fields.nota || fields.prosop !== undefined)) {
      const aceeasi = apts.filter(a => a.firma === fields.firma && a.nr !== nr)
      const updateFields = {}
      if (fields.nota) updateFields.nota = fields.nota
      if (fields.prosop !== undefined) updateFields.prosop = fields.prosop
      if (aceeasi.length > 0 && Object.keys(updateFields).length > 0) {
        await updateApartamenteMultiple(aceeasi.map(a => a.nr), updateFields)
        setApts(prev => prev.map(a => a.firma === fields.firma && a.nr !== nr ? { ...a, ...updateFields } : a))
      }
    }

    setApts(prev => prev.map(a => a.nr === nr ? { ...a, ...fields } : a))
    setModal(null)
    await updateApartament(nr, fields)
  }

  async function saveAddApt() {
    if (!editData.nr) { alert('Numarul apartamentului este obligatoriu!'); return }
    if (!editData.pret || Number(editData.pret) <= 0) { alert('Pretul este obligatoriu!'); return }
    if (!editData.tip_serviciu) editData.tip_serviciu = 'cazare'
    let status = editData.status || 'liber'
    if (editData.firma && editData.firma.trim() && status === 'liber') status = 'activ'
    if (editData.data_elib && editData.data_elib.trim()) status = 'elib'
    const apt = {
      nr: editData.nr, tip: editData.tip||'simplu', firma: editData.firma||'', nota: editData.nota||'',
      status, pret: editData.pret||0, plata: editData.plata||'OP',
      tip_serviciu: editData.tip_serviciu||'cazare',
      pret_utilitati: editData.pret_utilitati||0,
      utilitati_tip: editData.utilitati_tip||'fix',
      nr_locuri: editData.nr_locuri||2
    }
    if (editData.nr_nopti && editData.data_checkin) {
      const checkin = new Date(editData.data_checkin)
      checkin.setDate(checkin.getDate() + parseInt(editData.nr_nopti))
      apt.data_elib = checkin.getFullYear() + '-' + String(checkin.getMonth()+1).padStart(2,'0') + '-' + String(checkin.getDate()).padStart(2,'0')
    }
    setApts(prev => [...prev, { ...apt, ultima_curatenie: '', curatenie_status: '' }])
    setModal(null)
    await addApartament(apt)
  }

  async function saveMultiEdit() {
    const fields = {}
    if (editData.firma) fields.firma = editData.firma
    if (editData.nota) fields.nota = editData.nota
    if (editData.status) fields.status = editData.status
    if (editData.pret) fields.pret = editData.pret
    if (editData.plata) fields.plata = editData.plata
    if (editData.data_elib) fields.data_elib = editData.data_elib
    if (!Object.keys(fields).length) { alert('Completați cel puțin un câmp!'); return }
    const list = Array.from(selApts)
    setApts(prev => prev.map(a => list.includes(a.nr) ? { ...a, ...fields } : a))
    setModal(null); clearSel()
    await updateApartamenteMultiple(list, fields)
    alert(`Actualizate: ${list.length} apartamente`)
  }

  async function saveCurUnic() {
    const apt = apts.find(a => a.nr === editData.nr_apt)
    await programeazaCuratenie({ ...editData, tip_apt: apt?.tip, firma: apt?.firma })
    setModal(null)
    const c = await getCuratenie(); setCuratenii(c)
  }

  async function saveCurMulti() {
    const list = editData.selApts || []
    if (!list.length) { alert('Selectați cel puțin un apartament!'); return }
    await programeazaCuratenieMultipla(list, editData.data_programata, editData.tip_curatenie, editData.observatii, apts)
    setModal(null)
    const c = await getCuratenie(); setCuratenii(c)
    alert(`${list.length} apartamente programate!`)
  }

  async function saveCurApt() {
    const list = Array.from(selApts)
    await programeazaCuratenieMultipla(list, editData.data_programata, editData.tip_curatenie, editData.observatii||'', apts)
    setModal(null); clearSel()
    const c = await getCuratenie(); setCuratenii(c)
    alert(`${list.length} programate!`)
  }

  async function handleCellAction(action, curatenie) {
    if (action === 'sterge') {
      if (!window.confirm('Ștergi curățenia?')) return
      await stergeCuratenie(curatenie.id)
    } else if (action === 'add') {
      await programeazaDinCalendar(curatenie)
    }
    setModal(null)
    const c = await getCuratenie(); setCuratenii(c)
  }

  async function programeazaDinCalendar(obj) {
    const apt = apts.find(a => a.nr === obj.nr_apt)
    await programeazaCuratenie({ data_programata: obj.data_programata, nr_apt: obj.nr_apt, tip_apt: apt?.tip, firma: apt?.firma, tip_curatenie: obj.tip_curatenie, observatii: '' })
  }

  async function saveIst() {
    const s = editData.data_start, e = editData.data_end, p = Number(editData.pret_noapte)||0
    const z = s&&e ? Math.max(0, Math.round((new Date(e)-new Date(s))/86400000)) : 0
    const obj = { ...editData, nr_zile: z, total_estimat: z * p }
    if (!obj.firma || !obj.nr_apt || !s) { alert('Completați firma, apartament și data start!'); return }
    setIstoric(prev => [{ ...obj, id: Date.now() }, ...prev])
    setModal(null)
    await adaugaIstoric(obj)
  }

  async function delIst(id) {
    if (!window.confirm('Ștergi?')) return
    setIstoric(prev => prev.filter(r => r.id !== id))
    await stergeIstoric(id)
  }

  const byFirma = {}
  apts.filter(a => a.firma).forEach(a => {
    if (!byFirma[a.firma]) byFirma[a.firma] = { apts: [], pret: Number(a.pret)||0, plata: a.plata }
    byFirma[a.firma].apts.push(a)
  })

  const byFirmaInc = {}
  apts.filter(a => a.firma && a.status === 'activ' && Number(a.pret) > 0).forEach(a => {
    if (!byFirmaInc[a.firma]) byFirmaInc[a.firma] = { apts: [], p: Number(a.pret), pl: a.plata }
    byFirmaInc[a.firma].apts.push(a.nr)
  })
  const incRows = Object.entries(byFirmaInc).sort((a,b) => b[1].apts.length - a[1].apts.length)
  const incTotal = incRows.reduce((s,[,v]) => s + v.apts.length * v.p * 30, 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1F3864', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', marginBottom: 8 }}>EZEL</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginBottom: 24 }}>Se încarcă datele...</div>
      <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: '70%', background: '#fff', borderRadius: 2 }}></div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Topbar */}
      <div style={{ background: '#1F3864', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>EZEL — Manager</div>
          <div style={{ fontSize: 11, opacity: .7 }}>{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })} · {getNume()}</div>
        </div>
        <button className="btn" style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 12 }} onClick={handleLogout}>Ieși</button>
      </div>

      {/* Navigare cu dropdown */}
      <div style={{ background: '#fff', borderBottom: '1.5px solid #e0e0e0', padding: '0 12px', display: 'flex', gap: 2, position: 'relative', zIndex: 40 }}
        onMouseLeave={() => setOpenDropdown(null)}>
        {NAV_GROUPS.map(group => {
          const isActive = group.single
            ? tab === group.tab
            : group.items?.some(i => i.tab === tab)
          return (
            <div key={group.key} style={{ position: 'relative' }}
              onMouseEnter={() => !group.single && setOpenDropdown(group.key)}>
              <div
                onClick={() => {
                  if (group.single) { setTab(group.tab); setOpenDropdown(null) }
                  else setOpenDropdown(openDropdown === group.key ? null : group.key)
                }}
                style={{
                  padding: '11px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  color: isActive ? '#1F3864' : '#555',
                  borderBottom: `2.5px solid ${isActive ? '#1F3864' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}>
                {group.label}
                {!group.single && <span style={{ fontSize: 9, opacity: .6 }}>{openDropdown === group.key ? '▲' : '▼'}</span>}
              </div>
              {/* Dropdown */}
              {!group.single && openDropdown === group.key && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, minWidth: 180,
                  background: '#fff', borderRadius: '0 8px 8px 8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e8e8e8',
                  zIndex: 100, overflow: 'hidden'
                }}>
                  {group.items.map(item => (
                    <div key={item.tab}
                      onClick={() => { setTab(item.tab); setOpenDropdown(null) }}
                      style={{
                        padding: '10px 16px', fontSize: 13, cursor: 'pointer',
                        background: tab === item.tab ? '#EBF1FB' : '#fff',
                        color: tab === item.tab ? '#1F3864' : '#333',
                        fontWeight: tab === item.tab ? 600 : 400,
                        borderLeft: tab === item.tab ? '3px solid #1F3864' : '3px solid transparent',
                        transition: 'background .15s'
                      }}
                      onMouseEnter={e => { if(tab !== item.tab) e.currentTarget.style.background = '#f5f7fa' }}
                      onMouseLeave={e => { if(tab !== item.tab) e.currentTarget.style.background = '#fff' }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: 12, maxWidth: 1200, margin: '0 auto' }}>

        {/* CALENDAR */}
        {/* Scheduler notification */}
        {schedulerMsg && (
          <div style={{ background:'#E2EFDA', border:'1px solid #C0DD97', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#375623', fontWeight:500 }}>
            <span style={{ flex:1 }}>{schedulerMsg}</span>
            <button onClick={() => setSchedulerMsg(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#375623' }}>✕</button>
          </div>
        )}

        {tab === 0 && (
          <Calendar apts={apts} curatenii={curatenii} calAn={calAn} calLuna={calLuna}
            onChangeMonth={(d) => { let l = calLuna+d, a = calAn; if(l>11){l=0;a++}if(l<0){l=11;a--}; setCalLuna(l); setCalAn(a) }}
            onCellClick={(nr, zi, data) => {
              const cell = curatenii.find(c => c.nr_apt===nr && c.data_programata===data && c.status_curatenie!=='finalizata')
              setEditData({ nr_apt: nr, zi, data_programata: data, cell })
              setModal('cell')
            }}
            onAddMulti={() => { setEditData({ selApts: [], data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'intretinere' }); setModal('curMulti') }}
            onAutoSchedule={async () => {
              if (!window.confirm('Generezi automat curățeniile pentru săptămâna viitoare?')) return
              const r = await genereazaSaptamana()
              setSchedulerMsg(r.programate > 0 ? `✅ Programat ${r.programate} curățenii!` : '⚠️ Nimic de programat (toate sunt la zi)')
              setTimeout(() => setSchedulerMsg(null), 6000)
              loadAll()
            }}
            onStergeCuratenii={async (ids) => {
              for (const id of ids) await stergeCuratenie(id)
              const c = await getCuratenie(); setCuratenii(c)
            }}
            onMutaCuratenie={async (id, dataNoua) => {
              await supabase.from('curatenie').update({ data_programata: dataNoua }).eq('id', id)
              const c = await getCuratenie(); setCuratenii(c)
            }}
            onAddUnic={() => { setEditData({ nr_apt: apts[0]?.nr, data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'intretinere' }); setModal('curUnic') }}
          />
        )}

        {/* APARTAMENTE */}
        {tab === 1 && (
          <div>
            <div className="srch-row">
              <input placeholder="Caută..." value={srchApt} onChange={e => setSrchApt(e.target.value)} />
              <select value={fltStatus} onChange={e => setFltStatus(e.target.value)}>
                <option value="">Toate</option>
                <option value="activ">Ocupat</option>
                <option value="liber">Liber</option>
                <option value="elib">Eliberează</option>
                <option value="maint">Mentenanță</option>
              </select>
              <button className="btn btn-p" onClick={() => { setEditData({ tip: 'simplu', status: 'liber', plata: 'OP', tip_serviciu: 'cazare' }); setModal('addApt') }}>+ Apt nou</button>
              <button className="btn" style={{ background:'#EBF1FB', color:'#1F3864', border:'1px solid #90B8E8' }} onClick={() => { setEditData({}); setModal('editLocuri') }}>🛏 Locuri</button>
              <button className="btn btn-o" onClick={() => { setEditData({}); setModal('medit') }} disabled={selApts.size === 0}>✏️ Editează</button>
              <button className="btn btn-g" onClick={() => { setEditData({ data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'intretinere' }); setModal('mcur') }} disabled={selApts.size === 0}>🧹 Curățenie</button>
            </div>
            {selApts.size > 0 && (
              <div className="mbar">
                <span className="mcnt">{selApts.size} apartamente selectate</span>
                <button className="btn btn-o" onClick={() => { setEditData({}); setModal('medit') }}>✏️ Editează</button>
                <button className="btn btn-g" onClick={() => { setEditData({ data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'intretinere' }); setModal('mcur') }}>🧹 Curățenie</button>
                <button className="btn" style={{ background:'#FDECEA', color:'#c0392b', border:'1px solid #F5A0A0' }}
                  onClick={async () => {
                    const list = Array.from(selApts)
                    if (!window.confirm(`Ștergi curățeniile active pentru ${list.length} apartamente selectate?`)) return
                    for (const nr of list) {
                      const { data: cur } = await supabase.from('curatenie').select('id').eq('nr_apt', nr).neq('status_curatenie', 'finalizata')
                      if (cur) for (const c of cur) await stergeCuratenie(c.id)
                    }
                    setCuratenii(prev => prev.filter(c => !list.includes(String(c.nr_apt)) && !list.includes(c.nr_apt) || c.status_curatenie === 'finalizata'))
                    const fresh = await getCuratenie(); setCuratenii(fresh)
                    clearSel()
                  }}>🗑 Șterge curățenie</button>
                <button className="btn" onClick={clearSel}>✕</button>
              </div>
            )}
            <table className="tbl">
              <thead><tr>
                <th><input type="checkbox" onChange={e => { if(e.target.checked) setSelApts(new Set(filteredApts.map(a=>a.nr))); else clearSel() }} /></th>
                <th>Nr</th><th>Locuri</th><th>Firmă</th><th>Notă</th><th>Status</th><th>Preț</th><th>Ultima cur.</th><th>Urm. cur.</th><th></th>
              </tr></thead>
              <tbody>
                {filteredApts.map(a => {
                  const [bc, bl] = ST_MAP[a.status] || ['bk','—']
                  const statusLabel = a.status === 'elib' && a.data_elib ? `Elib. ${a.data_elib}` : bl
                  const isDbl = a.tip === 'dublu' || String(a.nr).startsWith('D')
                  return (
                    <tr key={a.nr} className={selApts.has(a.nr) ? 'sel' : ''} style={{ background: a.status==='liber' ? 'rgba(194,239,178,0.25)' : undefined }}>
                      <td><input type="checkbox" checked={selApts.has(a.nr)} onChange={() => toggleSel(a.nr)} /></td>
                      <td><strong>{a.nr}</strong>{isDbl && <span className="tip-d">2x</span>}</td>
                      <td style={{ textAlign:'center' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:12, fontWeight:600, color:'#1F3864', background:'#EBF1FB', padding:'2px 8px', borderRadius:8 }}>
                          {a.nr_locuri||2} locuri
                        </span>
                      </td>
                      <td>{a.firma || '—'}</td>
                      <td style={{ color: '#888', fontSize: 11 }}>{a.nota || '—'}</td>
                      <td><span className={`badge ${bc}`}>{statusLabel}</span></td>
                      <td>{a.pret ? `${a.pret} RON` : '—'}</td>
                      <td style={{ fontSize: 11, color: '#888' }}>{a.ultima_curatenie ? a.ultima_curatenie.split(' ')[0] : '—'}</td>
                      <td style={{ fontSize: 11, color: '#1F3864', fontWeight:500 }}>{(() => { const urm = curatenii.filter(c => c.nr_apt===a.nr && c.status_curatenie!=='finalizata').sort((x,y)=>x.data_programata>y.data_programata?1:-1)[0]; return urm ? urm.data_programata : '—' })()}</td>
                      <td><button className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => { setEditData({ ...a }); setModal('editApt') }}>✏️</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FIRME */}
        {tab === 2 && (
          <div>
            <div className="srch-row"><input placeholder="Caută firmă..." value={srchFirma} onChange={e => setSrchFirma(e.target.value)} /></div>
            {Object.entries(byFirma)
              .filter(([n]) => !srchFirma || n.toLowerCase().includes(srchFirma.toLowerCase()))
              .sort((a,b) => b[1].apts.length - a[1].apts.length)
              .map(([name, v]) => {
                const rev = v.apts.filter(a => a.status==='activ').reduce((s,a) => s+Number(a.pret)*30, 0)
                const elibApts = v.apts.filter(a => a.status==='elib')
                // Statistici din istoric pentru aceasta firma
                const istoricFirma = istoric.filter(r => r.firma === name)
                const pretMediu = istoricFirma.length > 0
                  ? Math.round(istoricFirma.reduce((s,r) => s + Number(r.pret_noapte||0), 0) / istoricFirma.length)
                  : v.pret
                const ultimaData = istoricFirma.length > 0
                  ? istoricFirma.sort((a,b) => new Date(b.data_end) - new Date(a.data_end))[0]?.data_end
                  : null
                const nrAptIstoric = new Set(istoricFirma.map(r => r.nr_apt)).size

                return (
                  <div key={name} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div className="firma-av">{name.substring(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{v.plata} · {v.pret} RON/apt/noapte</div>
                      </div>
                      <span className="badge bp2">{rev.toLocaleString()} RON/lună</span>
                    </div>
                    {/* Statistici firma */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
                      <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1F3864' }}>{v.apts.length}</div>
                        <div style={{ fontSize:10, color:'#888' }}>apt. active</div>
                      </div>
                      <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#375623' }}>{pretMediu} RON</div>
                        <div style={{ fontSize:10, color:'#888' }}>preț mediu</div>
                      </div>
                      <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#4527A0' }}>{ultimaData || '—'}</div>
                        <div style={{ fontSize:10, color:'#888' }}>ultima cazare</div>
                      </div>
                    </div>
                    {elibApts.length > 0 && <div className="aw" style={{ fontSize: 11 }}>⚠️ Eliberează: {elibApts.map(a => `AP${a.nr}${a.data_elib ? ' pe ' + a.data_elib : ''}`).join(', ')}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {v.apts.map(a => (
                        <span key={a.nr} className={`badge ${a.status==='activ'?'bb':a.status==='elib'?'br2':'bk'}`}
                          style={{ cursor: 'pointer' }} onClick={() => { setEditData({ ...a }); setModal('editApt') }}>
                          {a.nr}{a.nota ? ` · ${a.nota}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* ISTORIC */}
        {tab === 3 && (
          <div>
            <div className="srch-row">
              <input placeholder="Caută firmă..." value={srchIst} onChange={e => setSrchIst(e.target.value)} />
              <button className="btn btn-p" onClick={() => { setEditData({ nr_apt: apts[0]?.nr }); setModal('addIst') }}>+ Adaugă</button>
            </div>
            {(() => {
              const fil = istoric.filter(r => !srchIst || r.firma.toLowerCase().includes(srchIst.toLowerCase()))
              const tv = fil.reduce((s,r) => s+Number(r.total_estimat||0), 0)
              const fu = new Set(fil.map(r=>r.firma)).size
              const byF = {}
              fil.forEach(r => { if(!byF[r.firma])byF[r.firma]=[]; byF[r.firma].push(r) })
              return (
                <>
                  <div className="stats">
                    <div className="stat"><div className="stat-label">Înregistrări</div><div className="stat-val">{fil.length}</div></div>
                    <div className="stat"><div className="stat-label">Firme distincte</div><div className="stat-val">{fu}</div></div>
                    <div className="stat"><div className="stat-label">Total înregistrat</div><div className="stat-val">{tv.toLocaleString()} RON</div></div>
                  </div>
                  {Object.entries(byF).map(([firma, rows]) => {
                    const tot = rows.reduce((s,r) => s+Number(r.total_estimat||0), 0)
                    return (
                      <div key={firma} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div className="firma-av">{firma.substring(0,2).toUpperCase()}</div>
                          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{firma}</div><div style={{ fontSize: 11, color: '#888' }}>{rows.length} perioade</div></div>
                          <span className="badge bp2">{tot.toLocaleString()} RON</span>
                        </div>
                        <table className="tbl">
                          <thead><tr><th>Apt</th><th>Start</th><th>End</th><th>Zile</th><th>Preț</th><th>Total</th><th>Obs</th><th></th></tr></thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.id}>
                                <td>AP{r.nr_apt}</td>
                                <td>{r.data_start||'—'}</td><td>{r.data_end||'—'}</td>
                                <td>{r.nr_zile||'—'}</td>
                                <td>{r.pret_noapte?`${r.pret_noapte} RON`:'—'}</td>
                                <td><strong>{Number(r.total_estimat||0).toLocaleString()} RON</strong></td>
                                <td style={{ fontSize: 11, color: '#888' }}>{r.observatii||'—'}</td>
                                <td><button className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => delIst(r.id)}>🗑</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                  {fil.length === 0 && <div className="loading">Nicio înregistrare. Adaugă cu butonul de sus.</div>}
                </>
              )
            })()}
          </div>
        )}

        {/* INCASARI */}
        {tab === 4 && <IncasariTab apts={apts} />}

        {tab === 5 && <StatisticiPage />}
        {tab === 6 && <MentenantaTab />}
        {tab === 7 && <AmanariTab onRefreshCal={loadAll} />}
        {tab === 8 && <SpalatoriePage />}
        {tab === 9 && <SalariiTab />}
        {tab === 10 && <PontajTab />}
      </div>

      {/* MODAL EDIT APT */}
      {modal === 'editApt' && (
        <Modal title={`Editează AP ${editData.nr}`} onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Firmă</label>
            <input className="fi" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} />
          </div>
          <div className="fg"><label className="fl">Notă (ex: 2c/l)</label>
            <input className="fi" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#f8f9fa', borderRadius:8, marginBottom:8, cursor:'pointer' }}
            onClick={() => setEditData({...editData, prosop: !editData.prosop})}>
            <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${editData.prosop?'#1F3864':'#ddd'}`, background:editData.prosop?'#1F3864':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {editData.prosop && <span style={{ color:'#fff', fontSize:13 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, fontWeight:500, color:'#333' }}>🛁 Prosop inclus</span>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||'activ'} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="activ">Ocupat</option><option value="liber">Liber</option>
                <option value="elib">Eliberează</option><option value="maint">Mentenanță</option><option value="special">Special</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Data elib.</label>
              <input className="fi" value={editData.data_elib||''} placeholder="ex: 20.05" onChange={e => setEditData({...editData, data_elib: e.target.value})} />
            </div>
          </div>
          <div className="fg"><label className="fl">Tip serviciu</label>
            <select className="fi" value={editData.tip_serviciu||'cazare'} onChange={e => setEditData({...editData, tip_serviciu: e.target.value})}>
              <option value="cazare">Cazare (preț/noapte)</option>
              <option value="chirie">Chirie (preț/lună)</option>
            </select>
          </div>
          {(editData.tip_serviciu||'cazare') === 'cazare' ? (
            <div className="r2">
              <div className="fg"><label className="fl">Preț/noapte (RON)</label>
                <input className="fi" type="number" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} />
              </div>
              <div className="fg"><label className="fl">Nr. nopți</label>
                <input className="fi" type="number" placeholder="ex: 7" value={editData.nr_nopti_manual||''} onChange={e => {
                  const n = parseInt(e.target.value)||0
                  setEditData({...editData, nr_nopti_manual: e.target.value, total_estimat_manual: n * (Number(editData.pret)||0)})
                }} />
              </div>
            </div>
          ) : (
            <div className="fg"><label className="fl">Preț/lună (RON)</label>
              <input className="fi" type="number" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} />
            </div>
          )}
          {(editData.tip_serviciu||'cazare') === 'cazare' && editData.nr_nopti_manual && editData.pret && (
            <div style={{ background:'#E2EFDA', borderRadius:7, padding:'6px 10px', fontSize:12, color:'#375623', fontWeight:600 }}>
              Total estimat: {(parseInt(editData.nr_nopti_manual)||0) * (Number(editData.pret)||0)} RON ({editData.nr_nopti_manual} nopți × {editData.pret} RON)
            </div>
          )}
          {(editData.tip_serviciu||'cazare') === 'chirie' && (
            <div className="r2">
              <div className="fg"><label className="fl">Tip utilități</label>
                <select className="fi" value={editData.utilitati_tip||'variabil'} onChange={e => setEditData({...editData, utilitati_tip: e.target.value})}>
                  <option value="variabil">Variabil (introduc lunar)</option>
                  <option value="fix">Fix (sumă fixă/lună)</option>
                </select>
              </div>
              <div className="fg"><label className="fl">Utilități (RON)</label>
                <input className="fi" type="number" placeholder="0" value={editData.pret_utilitati||''} onChange={e => setEditData({...editData, pret_utilitati: e.target.value})} />
              </div>
            </div>
          )}
          <div className="r2">
            <div className="fg"><label className="fl">Plată</label>
              <select className="fi" value={editData.plata||'OP'} onChange={e => setEditData({...editData, plata: e.target.value})}>
                <option value="OP">OP</option><option value="Cash">Cash</option>
              </select>
            </div>
          </div>
          <div style={{ height: '0.5px', background: '#eee', margin: '10px 0' }}></div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6 }}>PROGRAMARE AUTOMATĂ CURĂȚENIE (opțional)</div>
          <div className="r2">
            <div className="fg">
              <label className="fl">Data check-in</label>
              <input className="fi" type="date" value={editData.data_checkin||''} onChange={e => setEditData({...editData, data_checkin: e.target.value})} />
            </div>
            <div className="fg">
              <label className="fl">Nr. nopți (1-7)</label>
              <select className="fi" value={editData.nr_nopti||''} onChange={e => setEditData({...editData, nr_nopti: e.target.value})}>
                <option value="">— nu seta —</option>
                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n===1?'noapte':'nopți'}</option>)}
              </select>
            </div>
          </div>
          {editData.nr_nopti && editData.data_checkin && (
            <div style={{ fontSize: 12, color: '#375623', background: '#E2EFDA', padding: '6px 10px', borderRadius: 7, marginTop: 4 }}>
              ✓ Curățenie generală pe {(() => { try { const d = new Date(editData.data_checkin); d.setDate(d.getDate() + parseInt(editData.nr_nopti)); return d.toLocaleDateString('ro-RO') } catch(e) { return '' } })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveEditApt}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL EDIT LOCURI */}
      {modal === 'editLocuri' && (
        <Modal title="Modifică nr. locuri per apartament" onClose={() => setModal(null)}>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {apts.filter(a => a.status !== 'maint').map(a => (
              <div key={a.nr} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f0f0f0' }}>
                <div style={{ width:44, fontWeight:700, color:'#1F3864', fontSize:13, flexShrink:0 }}>AP {a.nr}</div>
                <div style={{ fontSize:11, color:'#888', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.firma||'Liber'}</div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {[1,2,3,4,5,6].map(n => (
                    <div key={n} onClick={async () => {
                      setApts(prev => prev.map(x => x.nr===a.nr ? {...x, nr_locuri: n} : x))
                      await updateApartament(a.nr, { nr_locuri: n })
                    }}
                      style={{ width:32, height:32, borderRadius:7, border:`2px solid ${(a.nr_locuri||2)===n?'#1F3864':'#ddd'}`, background:(a.nr_locuri||2)===n?'#1F3864':'#fff', color:(a.nr_locuri||2)===n?'#fff':'#555', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button className="btn btn-p" onClick={() => setModal(null)}>Gata</button>
          </div>
        </Modal>
      )}

      {/* MODAL ADD APT */}
      {modal === 'addApt' && (
        <Modal title="Apartament nou" onClose={() => setModal(null)}>
          <div className="r2">
            <div className="fg"><label className="fl">Nr</label><input className="fi" placeholder="ex: 66" value={editData.nr||''} onChange={e => setEditData({...editData, nr: e.target.value})} /></div>
            <div className="fg"><label className="fl">Tip</label>
              <select className="fi" value={editData.tip||'simplu'} onChange={e => setEditData({...editData, tip: e.target.value})}>
                <option value="simplu">Simplu</option><option value="dublu">Dublu</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Notă</label><input className="fi" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} /></div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||'liber'} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="activ">Ocupat</option><option value="liber">Liber</option><option value="maint">Mentenanță</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Preț</label><input className="fi" type="number" placeholder="85" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Plată</label>
              <select className="fi" value={editData.plata||'OP'} onChange={e => setEditData({...editData, plata: e.target.value})}>
                <option value="OP">OP</option><option value="Cash">Cash</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Tip serviciu</label>
              <select className="fi" value={editData.tip_serviciu||'cazare'} onChange={e => setEditData({...editData, tip_serviciu: e.target.value})}>
                <option value="cazare">Cazare (preț/noapte)</option>
                <option value="chirie">Chirie (preț/lună)</option>
              </select>
            </div>
          </div>
          {editData.tip_serviciu === 'chirie' && (
            <div className="r2">
              <div className="fg"><label className="fl">Utilități (RON)</label>
                <input className="fi" type="number" placeholder="0" value={editData.pret_utilitati||''} onChange={e => setEditData({...editData, pret_utilitati: e.target.value})} />
              </div>
              <div className="fg"><label className="fl">Tip utilități</label>
                <select className="fi" value={editData.utilitati_tip||'fix'} onChange={e => setEditData({...editData, utilitati_tip: e.target.value})}>
                  <option value="fix">Fix</option><option value="variabil">Variabil</option>
                </select>
              </div>
            </div>
          )}
          <div style={{ height: '0.5px', background: '#eee', margin: '10px 0' }}></div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6 }}>PROGRAMARE AUTOMATĂ CURĂȚENIE (opțional)</div>
          <div className="r2">
            <div className="fg"><label className="fl">Data check-in</label>
              <input className="fi" type="date" value={editData.data_checkin||''} onChange={e => setEditData({...editData, data_checkin: e.target.value})} />
            </div>
            <div className="fg"><label className="fl">Nr. nopți (1-7)</label>
              <select className="fi" value={editData.nr_nopti||''} onChange={e => setEditData({...editData, nr_nopti: e.target.value})}>
                <option value="">— nu seta —</option>
                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n===1?'noapte':'nopți'}</option>)}
              </select>
            </div>
          </div>
          {editData.nr_nopti && editData.data_checkin && (
            <div style={{ fontSize: 12, color: '#375623', background: '#E2EFDA', padding: '6px 10px', borderRadius: 7, marginTop: 4 }}>
              ✓ Curățenie generală pe {(() => { try { const d = new Date(editData.data_checkin); d.setDate(d.getDate() + parseInt(editData.nr_nopti)); return d.toLocaleDateString('ro-RO') } catch(e) { return '' } })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveAddApt}>Adaugă</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL MULTI EDIT */}
      {modal === 'medit' && (
        <Modal title={`Editează ${selApts.size} apartamente`} onClose={() => setModal(null)}>
          <div className="ai">AP {Array.from(selApts).join(', AP ')}</div>
          <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Lasă gol câmpurile pe care nu vrei să le modifici.</p>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" placeholder="lasă gol = nu modifica" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Notă</label><input className="fi" placeholder="lasă gol = nu modifica" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} /></div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||''} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="">— nu modifica —</option><option value="activ">Ocupat</option>
                <option value="liber">Liber</option><option value="elib">Eliberează</option><option value="maint">Mentenanță</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Preț/noapte</label><input className="fi" type="number" placeholder="lasă gol" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Plată</label>
              <select className="fi" value={editData.plata||''} onChange={e => setEditData({...editData, plata: e.target.value})}>
                <option value="">— nu modifica —</option><option value="OP">OP</option><option value="Cash">Cash</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Data elib.</label><input className="fi" placeholder="ex: 20.05" value={editData.data_elib||''} onChange={e => setEditData({...editData, data_elib: e.target.value})} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveMultiEdit}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL CURATENIE UNIC */}
      {modal === 'curUnic' && (
        <Modal title="Programează curățenie" onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Apartament</label>
            <select className="fi" value={editData.nr_apt||''} onChange={e => setEditData({...editData, nr_apt: e.target.value})}>
              {apts.filter(a=>a.status!=='maint').map(a => <option key={a.nr} value={a.nr}>AP {a.nr} — {a.firma||'Liber'}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'intretinere'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="intretinere">Întreținere — același client</option>
              <option value="generala">Generală — la plecarea clientului</option>
              <option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurUnic}>✓ Programează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL CURATENIE MULTIPLA */}
      {modal === 'curMulti' && (
        <Modal title="Curățenie multiplă" onClose={() => setModal(null)}>
          <div className="fg">
            <label className="fl">Selectează apartamente</label>
            <div className="hint">Click = selectează/deselectează</div>
            <div className="asg">
              {apts.filter(a=>a.status!=='maint').map(a => (
                <div key={a.nr} className={`asi ${(editData.selApts||[]).includes(a.nr)?'sel':a.status==='activ'?'occ':''}`}
                  onClick={() => {
                    const prev = editData.selApts||[]
                    const next = prev.includes(a.nr) ? prev.filter(x=>x!==a.nr) : [...prev, a.nr]
                    setEditData({...editData, selApts: next})
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 10 }}>{a.nr}</div>
                  <div style={{ fontSize: 9, opacity: .7 }}>{(a.firma||'').substring(0,4)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'intretinere'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="intretinere">Întreținere</option>
              <option value="generala">Generală</option>
              <option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          {(editData.selApts||[]).length > 0 && <div className="ai" style={{ fontSize: 11 }}>{editData.selApts.length} selectate: AP {editData.selApts.join(', AP ')}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurMulti}>✓ Programează toate</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL CURATENIE DIN APT TAB */}
      {modal === 'mcur' && (
        <Modal title={`Curățenie — ${selApts.size} apartamente`} onClose={() => setModal(null)}>
          <div className="ai">AP {Array.from(selApts).join(', AP ')}</div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'intretinere'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="intretinere">Întreținere</option>
              <option value="generala">Generală</option>
              <option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurApt}>✓ Programează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* MODAL CLICK CELULA CALENDAR */}
      {modal === 'cell' && (
        <Modal title={`AP ${editData.nr_apt} — ${editData.data_programata}`} onClose={() => setModal(null)}>
          {editData.cell ? (
            <>
              <p style={{ marginBottom: 12 }}>
                <span className="badge bb">{editData.cell.tip_curatenie}</span>{' '}
                <span className={`badge ${editData.cell.status_curatenie==='finalizata'?'bg2':editData.cell.status_curatenie==='in progres'?'ba':'bb'}`}>{editData.cell.status_curatenie}</span>
              </p>
              {editData.cell.status_curatenie !== 'finalizata' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-r" onClick={() => handleCellAction('sterge', editData.cell)}>🗑 Șterge</button>
                  <button className="btn" onClick={() => setModal(null)}>Închide</button>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Nicio curățenie programată.</p>
              <div className="fg"><label className="fl">Tip</label>
                <select className="fi" value={editData.tip_curatenie||'intretinere'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
                  <option value="intretinere">Întreținere — același client</option>
                  <option value="generala">Generală — la plecare</option>
                  <option value="urgenta">Urgență</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => handleCellAction('add', editData)}>✓ Adaugă</button>
                <button className="btn" onClick={() => setModal(null)}>Anulează</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* MODAL ADD ISTORIC */}
      {modal === 'addIst' && (
        <Modal title="Adaugă înregistrare istorică" onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" placeholder="ex: ELM" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Apartament</label>
            <select className="fi" value={editData.nr_apt||''} onChange={e => setEditData({...editData, nr_apt: e.target.value})}>
              {apts.map(a => <option key={a.nr} value={a.nr}>AP {a.nr} — {a.firma||'Liber'}</option>)}
            </select>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Data start</label><input className="fi" type="date" value={editData.data_start||''} onChange={e => setEditData({...editData, data_start: e.target.value})} /></div>
            <div className="fg"><label className="fl">Data end</label><input className="fi" type="date" value={editData.data_end||''} onChange={e => setEditData({...editData, data_end: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Preț/noapte</label><input className="fi" type="number" placeholder="85" value={editData.pret_noapte||''} onChange={e => setEditData({...editData, pret_noapte: e.target.value})} /></div>
            <div className="fg"><label className="fl">Total (auto)</label>
              <input className="fi" readOnly style={{ background: '#f8f8f8', fontWeight: 600 }}
                value={editData.data_start&&editData.data_end&&editData.pret_noapte ?
                  (Math.max(0,Math.round((new Date(editData.data_end)-new Date(editData.data_start))/86400000)) * Number(editData.pret_noapte)).toLocaleString()+' RON' : ''} />
            </div>
          </div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveIst}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
