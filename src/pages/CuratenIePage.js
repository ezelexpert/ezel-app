import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { getCuratenie, getCuratenieAzi, marcheazaStatus } from '../lib/supabase'

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

export default function CuratenIePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [azi, setAzi] = useState([])
  const [toate, setToate] = useState([])
  const [finalizate, setFinalizate] = useState([])
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [aziData, toateData] = await Promise.all([
        getCuratenieAzi(),
        getCuratenie()
      ])
      setAzi(aziData
  .filter(c => c.status_curatenie !== 'finalizata')
  .sort((a, b) => parseInt(a.nr_apt) - parseInt(b.nr_apt))
)
      setToate(toateData
  .filter(c => c.status_curatenie !== 'finalizata')
  .sort((a, b) => parseInt(a.nr_apt) - parseInt(b.nr_apt))
)
      setFinalizate(toateData.filter(c => c.status_curatenie === 'finalizata'))
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  async function startCuratenie(c) {
    await marcheazaStatus(c.id, 'in progres', c.nr_apt)
    const update = x => x.id===c.id ? {...x, status_curatenie:'in progres'} : x
    setAzi(prev => prev.map(update))
    setToate(prev => prev.map(update))
    setChecks(prev => ({ ...prev, [c.id]: {} }))
  }

  async function finalizaCuratenie(c) {
    if (!window.confirm(`Confirmi că ai finalizat curățenia la AP ${c.nr_apt}?`)) return
    const now = new Date().toLocaleString('ro-RO')
    await marcheazaStatus(c.id, 'finalizata', c.nr_apt)
    const updated = {...c, status_curatenie:'finalizata', data_finalizare: now}
    setAzi(prev => prev.filter(x => x.id !== c.id))
    setToate(prev => prev.filter(x => x.id !== c.id))
    setFinalizate(prev => [updated, ...prev])
  }

  function toggleCheck(id, idx) {
    setChecks(prev => ({
      ...prev,
      [id]: { ...(prev[id]||{}), [idx]: !(prev[id]||{})[idx] }
    }))
  }

  function renderCard(c) {
    const isDbl = c.tip_apt === 'dublu' || String(c.nr_apt).startsWith('D')
    const checklist = isDbl ? CHECKLIST_DUBLU : CHECKLIST_SIMPLU
    const myChecks = checks[c.id] || {}
    const done = checklist.filter((_, i) => myChecks[i]).length
    const pct = Math.round(done / checklist.length * 100)
    const allDone = done === checklist.length
    const tipLabel = c.tip_curatenie==='generala'?'Generală (la plecare)':c.tip_curatenie==='intretinere'?'Întreținere':'Urgență'
    const tipColor = c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#1F3864':'#7B5E00'
    const tipBg = c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#EBF1FB':'#FFF2CC'
    const borderColor = c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#1F3864':'#F0C040'

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
        <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>📅 {c.data_programata}</div>

        {c.status_curatenie === 'finalizata' && (
          <div style={{ fontSize:12, color:'#888' }}>✅ Finalizată la: {c.data_finalizare || '—'}</div>
        )}

        {c.status_curatenie === 'in progres' && (
          <div style={{ background:'#f8f9fa', borderRadius:8, padding:'10px 12px', marginTop:10 }}>
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
          {c.status_curatenie === 'programata' && (
            <button style={{ flex:1, padding:'9px 16px', borderRadius:9, border:'1.5px solid #F0C040', background:'#FFF2CC', color:'#7B5E00', cursor:'pointer', fontSize:13, fontWeight:600 }}
              onClick={() => startCuratenie(c)}>▶ Începe</button>
          )}
          {c.status_curatenie === 'in progres' && (
            <button style={{ flex:1, padding:'9px 16px', borderRadius:9, border:'none', background:allDone?'#375623':'#aaa', color:'#fff', cursor:allDone?'pointer':'not-allowed', fontSize:13, fontWeight:600 }}
              disabled={!allDone} onClick={() => finalizaCuratenie(c)}>
              ✅ Marchez finalizată{!allDone?` (${checklist.length-done} rămase)`:''}
            </button>
          )}
        </div>
      </div>
    )
  }

  const lists = [azi, toate, finalizate]
  const emptyMsgs = [
    { icon:'✅', text:'Nu există curățenii programate pentru azi!' },
    { icon:'📋', text:'Nicio curățenie activă.' },
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

      <div style={{ display:'flex', background:'#fff', borderBottom:'2px solid #e0e0e0', padding:'0 14px' }}>
        {['Azi','Toate active','Finalizate'].map((t,i) => (
          <div key={i} onClick={() => setTab(i)}
            style={{ padding:'11px 16px', fontSize:13, cursor:'pointer', color:tab===i?'#375623':'#888', borderBottom:`2.5px solid ${tab===i?'#375623':'transparent'}`, fontWeight:500 }}>
            {t}{i===0&&azi.length>0?` (${azi.length})`:''}
          </div>
        ))}
      </div>

      <div style={{ padding:14, maxWidth:600, margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>
        ) : lists[tab].length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:'#bbb' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{emptyMsgs[tab].icon}</div>
            <div style={{ fontSize:13 }}>{emptyMsgs[tab].text}</div>
          </div>
        ) : (
          lists[tab].map(renderCard)
        )}
      </div>
    </div>
  )
}
