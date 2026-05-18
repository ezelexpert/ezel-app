import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { getCuratenie, getCuratenieAzi, marcheazaStatus, adaugaMentenanta, propuneAmanare, supabase } from '../lib/supabase'

const CHECKLIST_SIMPLU = [
  'Lenjerie de pat schimbată',
  'Praf șters pe toate suprafețele',
  'Baie curățată și dezinfectată',
  'WC dezinfectat interior/exterior',
  'Bucătărie curățată (aragaz, chiuvetă, plan lucru)',
  'Frigider verificat (alimente eliminate)',
  'Pardoseală aspirată',
  'Pardoseală mopată',
  'Gunoi aruncat, sac nou pus',
  'Consumabile completate (hârtie, săpun)',
  'Fotografie finală făcută',
]
const CHECKLIST_DUBLU = [
  'Camera 1 — lenjerie schimbată',
  'Camera 2 — lenjerie schimbată',
  'Baie 1 curățată și dezinfectată',
  'Baie 2 curățată și dezinfectată',
  'Praf șters toate suprafețele (ambele camere)',
  'Bucătărie curățată',
  'Pardoseală aspirată (tot apartamentul)',
  'Pardoseală mopată',
  'Gunoi aruncat în toate camerele',
  'Consumabile completate (ambele băi)',
  'Fotografie finală făcută',
]
const MOTIVE_AMANARE = [
  'Clientul nu a plecat',
  'Problema tehnică în apartament',
  'Nu am timp astăzi',
  'Lipsă materiale curățenie',
  'Alt motiv',
]
const NR_LENJERII = [1, 2, 3, 4, 5, 6]
const KG_PER_SET = 1.3

async function comprimaImagine(file, maxWidth = 1200, calitate = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }))
        }, 'image/jpeg', calitate)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function getToday() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

export default function CuratenIePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [azi, setAzi] = useState([])
  const [toate, setToate] = useState([])
  const [finalizate, setFinalizate] = useState([])
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState({})
  const [lenjerii, setLenjerii] = useState({})

  // Spalatorie
  const [spalatorie, setSpalatorie] = useState(null)
  const [spalLoading, setSpalLoading] = useState(false)
  const [inputSeturi, setInputSeturi] = useState('')
  const [inputKg, setInputKg] = useState('')
  const [toateGata, setToateGata] = useState(false)
  const [spalSaved, setSpalSaved] = useState(false)

  // Modal mentenanta
  const [modalMent, setModalMent] = useState(null)
  const [descriere, setDescriere] = useState('')
  const [fotografie, setFotografie] = useState(null)
  const [previzualizare, setPrevizualizare] = useState(null)
  const [trimitere, setTriimitere] = useState(false)
  const [trimis, setTrimis] = useState(false)
  const [marimeFisier, setMarimeFisier] = useState(null)
  const fileRef = useRef()

  // Modal amanare
  const [modalAman, setModalAman] = useState(null)
  const [amanData, setAmanData] = useState('')
  const [amanMotiv, setAmanMotiv] = useState(MOTIVE_AMANARE[0])
  const [amanAltMotiv, setAmanAltMotiv] = useState('')
  const [amanTrimis, setAmanTrimis] = useState(false)
  const [amanLoading, setAmanLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [aziData, toateData] = await Promise.all([getCuratenieAzi(), getCuratenie()])
      const sortFn = (a, b) => {
        const tipOrd = { intretinere: 0, generala: 1, urgenta: 2 }
        const tA = tipOrd[a.tip_curatenie] ?? 1, tB = tipOrd[b.tip_curatenie] ?? 1
        if (tA !== tB) return tA - tB
        return parseInt(a.nr_apt) - parseInt(b.nr_apt)
      }
      setAzi(aziData.filter(c => c.status_curatenie !== 'finalizata').sort(sortFn))
      setToate(toateData.filter(c => c.status_curatenie !== 'finalizata').sort((a, b) => {
        const dA = new Date(a.data_programata), dB = new Date(b.data_programata)
        if (dA - dB !== 0) return dA - dB
        const tipOrd = { intretinere: 0, generala: 1, urgenta: 2 }
        const tA = tipOrd[a.tip_curatenie] ?? 1, tB = tipOrd[b.tip_curatenie] ?? 1
        if (tA !== tB) return tA - tB
        return parseInt(a.nr_apt) - parseInt(b.nr_apt)
      }))
      setFinalizate(toateData.filter(c => c.status_curatenie === 'finalizata'))
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function loadSpalatorie() {
    setSpalLoading(true)
    try {
      const today = getToday()
      const { data } = await supabase.from('spalatorie').select('*').eq('data', today).single()
      if (data) {
        setSpalatorie(data)
        setInputSeturi(String(data.total_seturi || ''))
        setInputKg(String(data.total_kg || ''))
        setToateGata(data.toate_gata || false)
      }
    } catch(e) {}
    setSpalLoading(false)
  }

  // Calcul total kg din curateniile de azi cu lenjerii selectate
  const totalSeturiAzi = Object.values(lenjerii).reduce((s, n) => s + (n || 0), 0)
  const totalKgAzi = Math.round(totalSeturiAzi * KG_PER_SET * 10) / 10

  async function salvezaSpalatorie() {
    setSpalLoading(true)
    setSpalSaved(false)
    try {
      const today = getToday()
      const seturi = parseInt(inputSeturi) || totalSeturiAzi
      const kg = parseFloat(inputKg) || totalKgAzi
      const { data: existing } = await supabase.from('spalatorie').select('id').eq('data', today).single()
      if (existing) {
        await supabase.from('spalatorie').update({ total_seturi: seturi, total_kg: kg, toate_gata: toateGata }).eq('id', existing.id)
      } else {
        await supabase.from('spalatorie').insert({ data: today, total_seturi: seturi, total_kg: kg, toate_gata: toateGata })
      }
      setSpalSaved(true)
      setTimeout(() => setSpalSaved(false), 2000)
    } catch(e) { console.error(e) }
    setSpalLoading(false)
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  async function startCuratenie(c) {
    await marcheazaStatus(c.id, 'in progres', c.nr_apt)
    const upd = x => x.id === c.id ? {...x, status_curatenie: 'in progres'} : x
    setAzi(p => p.map(upd)); setToate(p => p.map(upd))
    setChecks(p => ({ ...p, [c.id]: {} }))
  }

  async function finalizaCuratenie(c) {
    if (!window.confirm(`Confirmi că ai finalizat curățenia la AP ${c.nr_apt}?`)) return
    const now = new Date().toLocaleString('ro-RO')
    await marcheazaStatus(c.id, 'finalizata', c.nr_apt)
    const updated = {...c, status_curatenie: 'finalizata', data_finalizare: now}
    setAzi(p => p.filter(x => x.id !== c.id))
    setToate(p => p.filter(x => x.id !== c.id))
    setFinalizate(p => [updated, ...p])
  }

  function toggleCheck(id, idx) {
    setChecks(p => ({ ...p, [id]: { ...(p[id]||{}), [idx]: !(p[id]||{})[idx] } }))
  }

  function selectLenjerii(id, n) {
    setLenjerii(p => ({ ...p, [id]: p[id] === n ? null : n }))
  }

  function deschideModalMent(c) {
    setModalMent(c); setDescriere(''); setFotografie(null)
    setPrevizualizare(null); setTrimis(false); setMarimeFisier(null)
  }

  async function selecteazaFoto(e) {
    const file = e.target.files[0]; if (!file) return
    const comp = await comprimaImagine(file)
    setFotografie(comp)
    setMarimeFisier({ original: (file.size/1024/1024).toFixed(2), comprimat: (comp.size/1024/1024).toFixed(2) })
    const reader = new FileReader()
    reader.onload = ev => setPrevizualizare(ev.target.result)
    reader.readAsDataURL(comp)
  }

  async function trimiteMentenanta() {
    if (!descriere.trim()) { alert('Descrie problema!'); return }
    setTriimitere(true)
    try {
      await adaugaMentenanta({ nr_apt: modalMent.nr_apt, firma: modalMent.firma || '', descriere: descriere.trim() }, fotografie)
      setTrimis(true)
    } catch(e) { alert('Eroare. Încearcă din nou.'); console.error(e) }
    setTriimitere(false)
  }

  function deschideModalAman(c) {
    const maine = new Date()
    maine.setDate(maine.getDate() + 1)
    const maineStr = maine.getFullYear() + '-' + String(maine.getMonth()+1).padStart(2,'0') + '-' + String(maine.getDate()).padStart(2,'0')
    setModalAman(c); setAmanData(maineStr)
    setAmanMotiv(MOTIVE_AMANARE[0]); setAmanAltMotiv(''); setAmanTrimis(false)
  }

  async function trimitePropunereAmanare() {
    if (!amanData) { alert('Selectează data!'); return }
    const motivFinal = amanMotiv === 'Alt motiv' ? amanAltMotiv.trim() : amanMotiv
    if (!motivFinal) { alert('Introdu motivul!'); return }
    setAmanLoading(true)
    try {
      await propuneAmanare(modalAman.id, amanData, motivFinal, modalAman.data_programata)
      const upd = x => x.id === modalAman.id ? {...x, amanare_status: 'propusa', amanare_propusa: amanData, amanare_motiv: motivFinal} : x
      setAzi(p => p.map(upd)); setToate(p => p.map(upd))
      setAmanTrimis(true)
    } catch(e) { alert('Eroare. Încearcă din nou.'); console.error(e) }
    setAmanLoading(false)
  }

  function renderCard(c) {
    const isDbl = c.tip_apt === 'dublu' || String(c.nr_apt).startsWith('D')
    const checklist = isDbl ? CHECKLIST_DUBLU : CHECKLIST_SIMPLU
    const myChecks = checks[c.id] || {}
    const done = checklist.filter((_,i) => myChecks[i]).length
    const pct = Math.round(done / checklist.length * 100)
    const allDone = done === checklist.length
    const tipLabel = c.tip_curatenie==='generala'?'Generală (la plecare)':c.tip_curatenie==='intretinere'?'Întreținere':'Urgență'
    const tipColor = c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#1F3864':'#7B5E00'
    const tipBg = c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#EBF1FB':'#FFF2CC'
    const borderColor = c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#1F3864':'#F0C040'
    const areAmanare = c.amanare_status === 'propusa'
    const nrLen = lenjerii[c.id]

    return (
      <div key={c.id} style={{ background:'#fff', borderRadius:12, border:`1px solid #e0e0e0`, borderLeft:`4px solid ${borderColor}`, padding:'14px 16px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:isDbl?'#EDE7F6':'#E2EFDA', color:isDbl?'#4527A0':'#375623', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
            {c.nr_apt}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1F3864' }}>
              Apartament {c.nr_apt}{isDbl && <span style={{ fontSize:9, background:'#EDE7F6', color:'#4527A0', padding:'1px 4px', borderRadius:3, marginLeft:4 }}>DUBLU</span>}
            </div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{c.firma || '—'}</div>
          </div>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:600,
            background: c.status_curatenie==='finalizata'?'#E2EFDA':c.status_curatenie==='in progres'?'#FFF2CC':'#EBF1FB',
            color: c.status_curatenie==='finalizata'?'#375623':c.status_curatenie==='in progres'?'#7B5E00':'#1F3864' }}>
            {c.status_curatenie==='finalizata'?'✅ Finalizată':c.status_curatenie==='in progres'?'⏳ În progres':'🔵 Programată'}
          </span>
        </div>

        <span style={{ display:'inline-block', fontSize:11, padding:'3px 10px', borderRadius:12, background:tipBg, color:tipColor, fontWeight:600, marginBottom:8 }}>{tipLabel}</span>
        <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>📅 {c.data_programata}</div>

        {areAmanare && (
          <div style={{ background:'#FFF2CC', border:'1px solid #F0C040', borderRadius:8, padding:'6px 10px', marginBottom:8, fontSize:12, color:'#7B5E00' }}>
            ⏳ <strong>Amânare propusă</strong> pentru {c.amanare_propusa} — aștepți aprobarea managerului
            <div style={{ fontSize:11, color:'#999', marginTop:2 }}>Motiv: {c.amanare_motiv}</div>
          </div>
        )}

        {c.status_curatenie === 'finalizata' && (
          <div style={{ fontSize:12, color:'#888' }}>✅ Finalizată la: {c.data_finalizare || '—'}</div>
        )}

        {c.status_curatenie === 'in progres' && (
          <div style={{ background:'#f8f9fa', borderRadius:8, padding:'10px 12px', marginTop:8 }}>
            {/* Lenjerii */}
            <div style={{ marginBottom:14, paddingBottom:12, borderBottom:'1px solid #eee' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#555', marginBottom:8 }}>
                🛏 Nr. lenjerii schimbate:
                {nrLen && <span style={{ marginLeft:8, background:'#375623', color:'#fff', padding:'1px 8px', borderRadius:10, fontSize:10 }}>{nrLen} set{nrLen>1?'uri':''} = {Math.round(nrLen*KG_PER_SET*10)/10} kg</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {NR_LENJERII.map(n => (
                  <div key={n} onClick={() => selectLenjerii(c.id, n)}
                    style={{ width:42, height:42, borderRadius:9, border:`2px solid ${nrLen===n?'#375623':'#ddd'}`, background:nrLen===n?'#375623':'#fff', color:nrLen===n?'#fff':'#555', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:700, fontSize:16, transition:'all .15s' }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist */}
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{done}/{checklist.length} puncte bifate</div>
            <div style={{ height:6, background:'#e0e0e0', borderRadius:3, marginBottom:10, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'#375623', borderRadius:3, transition:'width .3s' }}></div>
            </div>
            {checklist.map((item, idx) => (
              <div key={idx} onClick={() => toggleCheck(c.id, idx)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:idx<checklist.length-1?'1px solid #eee':'none', cursor:'pointer' }}>
                <input type="checkbox" checked={!!myChecks[idx]} readOnly style={{ width:18, height:18, accentColor:'#375623' }} />
                <label style={{ fontSize:13, cursor:'pointer', flex:1, textDecoration:myChecks[idx]?'line-through':'none', color:myChecks[idx]?'#aaa':'inherit' }}>{item}</label>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          {c.status_curatenie === 'programata' && !areAmanare && (
            <>
              <button style={{ flex:1, padding:'9px 16px', borderRadius:9, border:'1.5px solid #F0C040', background:'#FFF2CC', color:'#7B5E00', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => startCuratenie(c)}>▶ Începe</button>
              <button style={{ padding:'9px 12px', borderRadius:9, border:'1.5px solid #90B8E8', background:'#EBF1FB', color:'#1F3864', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => deschideModalAman(c)}>📅 Amână</button>
            </>
          )}
          {c.status_curatenie === 'in progres' && (
            <>
              <button style={{ flex:1, padding:'9px 16px', borderRadius:9, border:'none', background:allDone?'#375623':'#aaa', color:'#fff', cursor:allDone?'pointer':'not-allowed', fontSize:13, fontWeight:600 }}
                disabled={!allDone} onClick={() => finalizaCuratenie(c)}>
                ✅ Marchez finalizată{!allDone?` (${checklist.length-done} rămase)`:''}
              </button>
              <button style={{ padding:'9px 12px', borderRadius:9, border:'1.5px solid #F5A0A0', background:'#FDECEA', color:'#c0392b', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => deschideModalMent(c)}>🔧 Mentenanță</button>
              <button style={{ padding:'9px 12px', borderRadius:9, border:'1.5px solid #90B8E8', background:'#EBF1FB', color:'#1F3864', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => deschideModalAman(c)}>📅 Amână</button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── SPALATORIE TAB ─────────────────────────────────────────
  function renderSpalatorie() {
    const seturiAuto = totalSeturiAzi
    const kgAuto = totalKgAzi
    const seturiFinale = parseInt(inputSeturi) || seturiAuto
    const kgFinale = parseFloat(inputKg) || kgAuto

    return (
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        {/* Card total auto din lenjerii selectate */}
        <div style={{ background:'#EBF1FB', border:'1px solid #90B8E8', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
          <div style={{ fontSize:12, color:'#1F3864', fontWeight:600, marginBottom:8 }}>📊 Calculat automat din curățeniile de azi</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'#fff', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#1F3864' }}>{seturiAuto}</div>
              <div style={{ fontSize:11, color:'#888' }}>seturi lenjerie</div>
            </div>
            <div style={{ background:'#fff', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#1F3864' }}>{kgAuto} kg</div>
              <div style={{ fontSize:11, color:'#888' }}>total de spălat</div>
            </div>
          </div>
          <div style={{ fontSize:11, color:'#888', marginTop:8, textAlign:'center' }}>1 set = {KG_PER_SET} kg · {seturiAuto} seturi × {KG_PER_SET} = {kgAuto} kg</div>
        </div>

        {/* Input manual */}
        <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:12 }}>✏️ Sau introdu manual (dacă ai lenjerii din alte surse)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Nr. seturi</label>
              <input type="number" min="0" value={inputSeturi} onChange={e => { setInputSeturi(e.target.value); if(e.target.value) setInputKg(String(Math.round(parseFloat(e.target.value)*KG_PER_SET*10)/10)) }}
                placeholder={String(seturiAuto)}
                style={{ width:'100%', padding:'8px 10px', fontSize:16, fontWeight:700, border:'1.5px solid #ddd', borderRadius:8, outline:'none', textAlign:'center' }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Total kg</label>
              <input type="number" min="0" step="0.1" value={inputKg} onChange={e => { setInputKg(e.target.value); if(e.target.value) setInputSeturi(String(Math.round(parseFloat(e.target.value)/KG_PER_SET))) }}
                placeholder={String(kgAuto)}
                style={{ width:'100%', padding:'8px 10px', fontSize:16, fontWeight:700, border:'1.5px solid #ddd', borderRadius:8, outline:'none', textAlign:'center' }} />
            </div>
          </div>

          {/* Checkbox toate gata */}
          <div onClick={() => setToateGata(p => !p)}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, border:`2px solid ${toateGata?'#375623':'#ddd'}`, background:toateGata?'#E2EFDA':'#f8f9fa', cursor:'pointer', marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:8, border:`2px solid ${toateGata?'#375623':'#ccc'}`, background:toateGata?'#375623':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
              {toateGata && '✓'}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:toateGata?'#375623':'#333' }}>✅ Toate lenjерiile spălate și călcate</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{seturiFinale} seturi · {kgFinale} kg</div>
            </div>
          </div>

          <button onClick={salvezaSpalatorie} disabled={spalLoading}
            style={{ width:'100%', padding:'12px', background:spalSaved?'#375623':'#1F3864', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', transition:'background .3s' }}>
            {spalLoading ? 'Se salvează...' : spalSaved ? '✅ Salvat!' : '💾 Salvează raportul de azi'}
          </button>
        </div>

        {/* Info */}
        <div style={{ fontSize:11, color:'#aaa', textAlign:'center', lineHeight:1.6 }}>
          Raportul se salvează pentru ziua de azi.<br/>
          Managerul poate vedea statisticile în aplicație.
        </div>
      </div>
    )
  }

  const TABS_CUR = ['Azi', 'Toate active', '🧺 Spălătorie', 'Finalizate']
  const lists = [azi, toate, null, finalizate]
  const emptyMsgs = [
    { icon:'✅', text:'Nu există curățenii programate pentru azi!' },
    { icon:'📋', text:'Nicio curățenie activă.' },
    null,
    { icon:'🧹', text:'Nicio curățenie finalizată încă.' },
  ]

  return (
    <div>
      <div style={{ background:'#375623', color:'#fff', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>🧹 Curățenie EZEL</div>
          <div style={{ fontSize:11, opacity:.8 }}>{new Date().toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</div>
        </div>
        <button style={{ padding:'5px 12px', background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.35)', color:'#fff', borderRadius:7, cursor:'pointer', fontSize:12 }}
          onClick={handleLogout}>Ieși</button>
      </div>

      <div style={{ display:'flex', background:'#fff', borderBottom:'2px solid #e0e0e0', padding:'0 14px', overflowX:'auto' }}>
        {TABS_CUR.map((t,i) => (
          <div key={i} onClick={() => { setTab(i); if(i===2) loadSpalatorie() }}
            style={{ padding:'11px 14px', fontSize:13, cursor:'pointer', color:tab===i?'#375623':'#888', borderBottom:`2.5px solid ${tab===i?'#375623':'transparent'}`, fontWeight:500, whiteSpace:'nowrap' }}>
            {t}{i===0&&azi.length>0?` (${azi.length})`:''}
          </div>
        ))}
      </div>

      <div style={{ padding:14, maxWidth:600, margin:'0 auto' }}>
        {tab === 2 ? renderSpalatorie() :
          loading ? <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>
          : lists[tab].length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 20px', color:'#bbb' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>{emptyMsgs[tab].icon}</div>
              <div style={{ fontSize:13 }}>{emptyMsgs[tab].text}</div>
            </div>
          ) : lists[tab].map(renderCard)
        }
      </div>

      {/* MODAL AMANARE */}
      {modalAman && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setModalAman(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:20, width:'100%', maxWidth:400, maxHeight:'90vh', overflowY:'auto' }}>
            {amanTrimis ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>⏳</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#1F3864', marginBottom:8 }}>Propunere trimisă!</div>
                <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>Managerul va aproba sau respinge amânarea pentru AP {modalAman.nr_apt}.</div>
                <button style={{ padding:'10px 24px', background:'#1F3864', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}
                  onClick={() => setModalAman(null)}>Închide</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1F3864' }}>📅 Propune amânare</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:2 }}>AP {modalAman.nr_apt} — {modalAman.firma||'—'}</div>
                  </div>
                  <button onClick={() => setModalAman(null)} style={{ width:30, height:30, borderRadius:'50%', border:'1px solid #eee', background:'#f5f5f5', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
                <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:14, fontSize:12, color:'#666' }}>
                  Data curentă: <strong>{modalAman.data_programata}</strong>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Data nouă propusă *</label>
                  <input type="date" value={amanData} onChange={e => setAmanData(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width:'100%', padding:'7px 9px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Motiv *</label>
                  {MOTIVE_AMANARE.map(m => (
                    <div key={m} onClick={() => setAmanMotiv(m)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, border:`1.5px solid ${amanMotiv===m?'#1F3864':'#eee'}`, background:amanMotiv===m?'#EBF1FB':'#fff', cursor:'pointer', marginBottom:5 }}>
                      <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${amanMotiv===m?'#1F3864':'#ccc'}`, background:amanMotiv===m?'#1F3864':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {amanMotiv===m && <div style={{ width:6, height:6, borderRadius:'50%', background:'#fff' }}></div>}
                      </div>
                      <span style={{ fontSize:13, color:amanMotiv===m?'#1F3864':'#333' }}>{m}</span>
                    </div>
                  ))}
                  {amanMotiv === 'Alt motiv' && (
                    <input value={amanAltMotiv} onChange={e => setAmanAltMotiv(e.target.value)} placeholder="Descrie motivul..."
                      style={{ width:'100%', padding:'7px 9px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none', marginTop:4 }} />
                  )}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button onClick={trimitePropunereAmanare} disabled={amanLoading||!amanData}
                    style={{ flex:1, padding:'11px', background:'#1F3864', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', opacity:amanLoading||!amanData?0.5:1 }}>
                    {amanLoading ? 'Se trimite...' : '📅 Trimite propunere'}
                  </button>
                  <button onClick={() => setModalAman(null)} style={{ padding:'11px 16px', border:'1px solid #ddd', background:'#fff', borderRadius:10, fontSize:14, cursor:'pointer' }}>Anulează</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL MENTENANTA */}
      {modalMent && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setModalMent(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:20, width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>
            {trimis ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#375623', marginBottom:8 }}>Problemă raportată!</div>
                <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>Mentenanța pentru AP {modalMent.nr_apt} a fost trimisă.</div>
                <button style={{ padding:'10px 24px', background:'#375623', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}
                  onClick={() => setModalMent(null)}>Închide</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#c0392b' }}>🔧 Raportează mentenanță</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:2 }}>AP {modalMent.nr_apt} — {modalMent.firma||'—'}</div>
                  </div>
                  <button onClick={() => setModalMent(null)} style={{ width:30, height:30, borderRadius:'50%', border:'1px solid #eee', background:'#f5f5f5', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Apartament</label>
                  <div style={{ padding:'8px 10px', background:'#f8f9fa', borderRadius:8, border:'1px solid #eee', fontSize:13, fontWeight:600, color:'#1F3864' }}>
                    AP {modalMent.nr_apt} — {modalMent.firma||'—'}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Descrie problema *</label>
                  <textarea value={descriere} onChange={e => setDescriere(e.target.value)} placeholder="Ex: Bec ars în baie, robinet picură..."
                    style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none', minHeight:90, resize:'vertical', fontFamily:'inherit' }} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Fotografie (opțional)</label>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={selecteazaFoto} style={{ display:'none' }} />
                  {previzualizare ? (
                    <div style={{ position:'relative' }}>
                      <img src={previzualizare} alt="prev" style={{ width:'100%', borderRadius:8, maxHeight:200, objectFit:'cover' }} />
                      <button onClick={() => { setFotografie(null); setPrevizualizare(null); setMarimeFisier(null); fileRef.current.value='' }}
                        style={{ position:'absolute', top:6, right:6, width:28, height:28, borderRadius:'50%', background:'rgba(0,0,0,.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14 }}>✕</button>
                      {marimeFisier && <div style={{ marginTop:4, fontSize:10, color:'#888', textAlign:'center' }}>Original: {marimeFisier.original}MB → {marimeFisier.comprimat}MB</div>}
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current.click()}
                      style={{ width:'100%', padding:'12px', border:'1.5px dashed #ddd', borderRadius:8, background:'#fafafa', cursor:'pointer', fontSize:13, color:'#888', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      📷 Adaugă fotografie
                    </button>
                  )}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={trimiteMentenanta} disabled={trimitere||!descriere.trim()}
                    style={{ flex:1, padding:'11px', background:descriere.trim()?'#c0392b':'#aaa', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:descriere.trim()?'pointer':'not-allowed' }}>
                    {trimitere ? 'Se trimite...' : '🔧 Trimite raport'}
                  </button>
                  <button onClick={() => setModalMent(null)} style={{ padding:'11px 16px', border:'1px solid #ddd', background:'#fff', borderRadius:10, fontSize:14, cursor:'pointer' }}>Anulează</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
