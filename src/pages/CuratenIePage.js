import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { getCuratenie, getCuratenieAzi, marcheazaStatus, adaugaMentenanta } from '../lib/supabase'

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

// Comprima imaginea inainte de upload
async function comprimaImagine(file, maxWidth = 1200, calitate = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height

        // Redimensioneaza daca e prea mare
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }

        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob(
          (blob) => {
            // Creeaza un nou File din blob comprimat
            const comprimat = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(comprimat)
          },
          'image/jpeg',
          calitate
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function CuratenIePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [azi, setAzi] = useState([])
  const [toate, setToate] = useState([])
  const [finalizate, setFinalizate] = useState([])
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState({})
  const [modalMent, setModalMent] = useState(null)
  const [descriere, setDescriere] = useState('')
  const [fotografie, setFotografie] = useState(null)
  const [previzualizare, setPrevizualizare] = useState(null)
  const [trimitere, setTriimitere] = useState(false)
  const [trimis, setTrimis] = useState(false)
  const [marimeFisier, setMarimeFisier] = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [aziData, toateData] = await Promise.all([
        getCuratenieAzi(),
        getCuratenie()
      ])

      const sortTip = (a, b) => {
        const tipOrd = { intretinere: 0, generala: 1, urgenta: 2 }
        const tA = tipOrd[a.tip_curatenie] ?? 1
        const tB = tipOrd[b.tip_curatenie] ?? 1
        if (tA !== tB) return tA - tB
        return parseInt(a.nr_apt) - parseInt(b.nr_apt)
      }

      setAzi(aziData.filter(c => c.status_curatenie !== 'finalizata').sort(sortTip))
      setToate(toateData.filter(c => c.status_curatenie !== 'finalizata').sort((a, b) => {
        const dataA = new Date(a.data_programata)
        const dataB = new Date(b.data_programata)
        if (dataA - dataB !== 0) return dataA - dataB
        const tipOrd = { intretinere: 0, generala: 1, urgenta: 2 }
        const tA = tipOrd[a.tip_curatenie] ?? 1
        const tB = tipOrd[b.tip_curatenie] ?? 1
        if (tA !== tB) return tA - tB
        return parseInt(a.nr_apt) - parseInt(b.nr_apt)
      }))
      setFinalizate(toateData.filter(c => c.status_curatenie === 'finalizata'))
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  async function startCuratenie(c) {
    await marcheazaStatus(c.id, 'in progres', c.nr_apt)
    const update = x => x.id === c.id ? {...x, status_curatenie: 'in progres'} : x
    setAzi(prev => prev.map(update))
    setToate(prev => prev.map(update))
    setChecks(prev => ({ ...prev, [c.id]: {} }))
  }

  async function finalizaCuratenie(c) {
    if (!window.confirm(`Confirmi că ai finalizat curățenia la AP ${c.nr_apt}?`)) return
    const now = new Date().toLocaleString('ro-RO')
    await marcheazaStatus(c.id, 'finalizata', c.nr_apt)
    const updated = {...c, status_curatenie: 'finalizata', data_finalizare: now}
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

  function deschideModalMent(c) {
    setModalMent(c)
    setDescriere('')
    setFotografie(null)
    setPrevizualizare(null)
    setTrimis(false)
    setMarimeFisier(null)
  }

  async function selecteazaFoto(e) {
    const file = e.target.files[0]
    if (!file) return

    // Comprima imaginea
    const comprimat = await comprimaImagine(file)
    setFotografie(comprimat)

    // Calculeaza marimea
    const mb = (comprimat.size / 1024 / 1024).toFixed(2)
    const mbOriginal = (file.size / 1024 / 1024).toFixed(2)
    setMarimeFisier({ original: mbOriginal, comprimat: mb })

    // Previzualizare
    const reader = new FileReader()
    reader.onload = (ev) => setPrevizualizare(ev.target.result)
    reader.readAsDataURL(comprimat)
  }

  async function trimiteMentenanta() {
    if (!descriere.trim()) { alert('Descrie problema!'); return }
    setTriimitere(true)
    try {
      await adaugaMentenanta({
        nr_apt: modalMent.nr_apt,
        firma: modalMent.firma || '',
        descriere: descriere.trim()
      }, fotografie)
      setTrimis(true)
    } catch(e) {
      alert('Eroare la trimitere. Încearcă din nou.')
      console.error(e)
    }
    setTriimitere(false)
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
            <>
              <button style={{ flex:1, padding:'9px 16px', borderRadius:9, border:'none', background:allDone?'#375623':'#aaa', color:'#fff', cursor:allDone?'pointer':'not-allowed', fontSize:13, fontWeight:600 }}
                disabled={!allDone} onClick={() => finalizaCuratenie(c)}>
                ✅ Marchez finalizată{!allDone?` (${checklist.length-done} rămase)`:''}
              </button>
              <button style={{ padding:'9px 14px', borderRadius:9, border:'1.5px solid #F5A0A0', background:'#FDECEA', color:'#c0392b', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => deschideModalMent(c)}>
                🔧 Mentenanță
              </button>
            </>
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

      {/* MODAL MENTENANTA */}
      {modalMent && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setModalMent(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'20px', width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>

            {trimis ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#375623', marginBottom:8 }}>Problemă raportată!</div>
                <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>
                  Mentenanța pentru AP {modalMent.nr_apt} a fost trimisă managerului.
                </div>
                <button style={{ padding:'10px 24px', background:'#375623', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}
                  onClick={() => setModalMent(null)}>Închide</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#c0392b' }}>🔧 Raportează mentenanță</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:2 }}>AP {modalMent.nr_apt} — {modalMent.firma||'—'}</div>
                  </div>
                  <button onClick={() => setModalMent(null)}
                    style={{ width:30, height:30, borderRadius:'50%', border:'1px solid #eee', background:'#f5f5f5', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Apartament</label>
                  <div style={{ padding:'8px 10px', background:'#f8f9fa', borderRadius:8, border:'1px solid #eee', fontSize:13, fontWeight:600, color:'#1F3864' }}>
                    AP {modalMent.nr_apt} — {modalMent.firma||'—'}
                  </div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Descrie problema *</label>
                  <textarea value={descriere} onChange={e => setDescriere(e.target.value)}
                    placeholder="Ex: Bec ars în baie, robinet picură, pată pe saltea..."
                    style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none', minHeight:90, resize:'vertical', fontFamily:'inherit' }} />
                </div>

                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>
                    Fotografie (opțional)
                  </label>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    onChange={selecteazaFoto} style={{ display:'none' }} />

                  {previzualizare ? (
                    <div style={{ position:'relative' }}>
                      <img src={previzualizare} alt="previzualizare"
                        style={{ width:'100%', borderRadius:8, maxHeight:200, objectFit:'cover' }} />
                      <button onClick={() => { setFotografie(null); setPrevizualizare(null); setMarimeFisier(null); fileRef.current.value='' }}
                        style={{ position:'absolute', top:6, right:6, width:28, height:28, borderRadius:'50%', background:'rgba(0,0,0,.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14 }}>✕</button>
                      {marimeFisier && (
                        <div style={{ marginTop:4, fontSize:10, color:'#888', textAlign:'center' }}>
                          Original: {marimeFisier.original}MB → Comprimat: {marimeFisier.comprimat}MB
                        </div>
                      )}
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
                  <button onClick={() => setModalMent(null)}
                    style={{ padding:'11px 16px', border:'1px solid #ddd', background:'#fff', borderRadius:10, fontSize:14, cursor:'pointer' }}>
                    Anulează
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
