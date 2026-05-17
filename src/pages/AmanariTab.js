import React, { useState, useEffect } from 'react'
import { getCuratenie, aprobaAmanare, respingeAmanare, amanareDirecta } from '../lib/supabase'

export default function AmanariTab({ onRefreshCal }) {
  const [curatenii, setCuratenii] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('propuse') // 'propuse' | 'directa'
  // Modal amanare directa
  const [modalDir, setModalDir] = useState(null)
  const [dirData, setDirData] = useState('')
  const [dirMotiv, setDirMotiv] = useState('')
  const [dirLoading, setDirLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getCuratenie()
      setCuratenii(data)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const propuse = curatenii.filter(c => c.amanare_status === 'propusa')
  const istoricAman = curatenii.filter(c => c.amanare_status === 'aprobata' || c.amanare_status === 'respinsa')
  const active = curatenii.filter(c => c.status_curatenie !== 'finalizata' && c.amanare_status !== 'propusa')

  async function handleAproba(c) {
    if (!window.confirm(`Aprobi amânarea AP ${c.nr_apt} pentru ${c.amanare_propusa}?`)) return
    await aprobaAmanare(c.id)
    setCuratenii(prev => prev.map(x => x.id===c.id ? {...x, amanare_status:'aprobata', data_programata: x.amanare_propusa, status_curatenie:'programata'} : x))
    if (onRefreshCal) onRefreshCal()
  }

  async function handleRespinge(c) {
    if (!window.confirm(`Respingi amânarea AP ${c.nr_apt}? Rămâne pe data originală.`)) return
    await respingeAmanare(c.id)
    setCuratenii(prev => prev.map(x => x.id===c.id ? {...x, amanare_status:'respinsa', amanare_propusa:null, amanare_motiv:''} : x))
  }

  async function handleAmanareDirecta() {
    if (!dirData || !dirMotiv.trim()) { alert('Completează data și motivul!'); return }
    setDirLoading(true)
    try {
      await amanareDirecta(modalDir.id, dirData, dirMotiv.trim())
      setCuratenii(prev => prev.map(x => x.id===modalDir.id ? {...x, data_programata: dirData, amanare_status:'aprobata', amanare_motiv: dirMotiv} : x))
      setModalDir(null)
      if (onRefreshCal) onRefreshCal()
    } catch(e) { alert('Eroare. Încearcă din nou.') }
    setDirLoading(false)
  }

  function deschideDir(c) {
    const maine = new Date()
    maine.setDate(maine.getDate() + 1)
    setModalDir(c)
    setDirData(maine.toISOString().split('T')[0])
    setDirMotiv('')
  }

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, marginBottom:14 }}>
        <div style={{ background:'#FFF2CC', borderRadius:10, padding:'10px 12px', border:'1px solid #F0C040', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#7B5E00' }}>{propuse.length}</div>
          <div style={{ fontSize:11, color:'#7B5E00' }}>⏳ Amanari propuse</div>
        </div>
        <div style={{ background:'#E2EFDA', borderRadius:10, padding:'10px 12px', border:'1px solid #C0DD97', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{istoricAman.filter(c=>c.amanare_status==='aprobata').length}</div>
          <div style={{ fontSize:11, color:'#375623' }}>✅ Aprobate</div>
        </div>
        <div style={{ background:'#FDECEA', borderRadius:10, padding:'10px 12px', border:'1px solid #F5A0A0', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#c0392b' }}>{istoricAman.filter(c=>c.amanare_status==='respinsa').length}</div>
          <div style={{ fontSize:11, color:'#c0392b' }}>❌ Respinse</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1.5px solid #e0e0e0', marginBottom:12 }}>
        {[['propuse','⏳ De aprobat'],['directa','📅 Amânare directă'],['istoric','📋 Istoric']].map(([k,lbl]) => (
          <div key={k} onClick={() => setTab(k)}
            style={{ padding:'9px 14px', fontSize:13, cursor:'pointer', fontWeight:500,
              color: tab===k?'#1F3864':'#888',
              borderBottom: tab===k?'2.5px solid #1F3864':'2.5px solid transparent' }}>
            {lbl}{k==='propuse'&&propuse.length>0?` (${propuse.length})`:''}
          </div>
        ))}
      </div>

      {/* Tab: De aprobat */}
      {tab === 'propuse' && (
        propuse.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
            <div>Nicio amânare de aprobat.</div>
          </div>
        ) : propuse.map(c => (
          <div key={c.id} style={{ background:'#fff', border:'1.5px solid #F0C040', borderLeft:'4px solid #F0C040', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#FFF2CC', color:'#7B5E00', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0 }}>
                {c.nr_apt}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700 }}>AP {c.nr_apt} — {c.firma||'—'}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Angajata a propus amânare</div>
              </div>
              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:12, fontWeight:600, background:'#FFF2CC', color:'#7B5E00' }}>⏳ Propusă</span>
            </div>

            <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                <div><div style={{ color:'#888', marginBottom:2 }}>Data curentă</div><div style={{ fontWeight:600 }}>{c.data_programata}</div></div>
                <div><div style={{ color:'#888', marginBottom:2 }}>Data propusă</div><div style={{ fontWeight:600, color:'#1F3864' }}>{c.amanare_propusa}</div></div>
              </div>
              <div style={{ marginTop:8, fontSize:12 }}>
                <span style={{ color:'#888' }}>Motiv: </span>
                <span style={{ fontWeight:500 }}>{c.amanare_motiv}</span>
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => handleAproba(c)}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'1.5px solid #C0DD97', background:'#E2EFDA', color:'#375623', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                ✅ Aprobă amânarea
              </button>
              <button onClick={() => handleRespinge(c)}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'1.5px solid #F5A0A0', background:'#FDECEA', color:'#c0392b', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                ❌ Respinge
              </button>
            </div>
          </div>
        ))
      )}

      {/* Tab: Amanare directa */}
      {tab === 'directa' && (
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:12, background:'#EBF1FB', padding:'8px 12px', borderRadius:8 }}>
            💡 Selectează o curățenie din lista de mai jos pentru a o amâna direct, fără propunere din partea angajatei.
          </div>
          {active.length === 0 ? (
            <div style={{ textAlign:'center', padding:30, color:'#aaa' }}>Nicio curățenie activă.</div>
          ) : active.sort((a,b) => new Date(a.data_programata)-new Date(b.data_programata)).map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#fff', border:'1px solid #e8e8e8', borderRadius:8, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#EBF1FB', color:'#1F3864', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                {c.nr_apt}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>AP {c.nr_apt} — {c.firma||'—'}</div>
                <div style={{ fontSize:11, color:'#888' }}>📅 {c.data_programata} · {c.tip_curatenie}</div>
              </div>
              <button onClick={() => deschideDir(c)}
                style={{ padding:'6px 12px', borderRadius:7, border:'1.5px solid #90B8E8', background:'#EBF1FB', color:'#1F3864', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                📅 Amână
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Istoric */}
      {tab === 'istoric' && (
        istoricAman.length === 0 ? (
          <div style={{ textAlign:'center', padding:30, color:'#aaa' }}>Niciun istoric de amânări.</div>
        ) : istoricAman.sort((a,b) => new Date(b.data_programata)-new Date(a.data_programata)).map(c => (
          <div key={c.id} style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:`4px solid ${c.amanare_status==='aprobata'?'#375623':'#c0392b'}`, borderRadius:8, padding:'10px 12px', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>AP {c.nr_apt} — {c.firma||'—'}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                  {c.data_originala && <span>Original: {c.data_originala} → </span>}
                  Nou: {c.data_programata}
                </div>
                {c.amanare_motiv && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>Motiv: {c.amanare_motiv}</div>}
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                background: c.amanare_status==='aprobata'?'#E2EFDA':'#FDECEA',
                color: c.amanare_status==='aprobata'?'#375623':'#c0392b' }}>
                {c.amanare_status==='aprobata'?'✅ Aprobată':'❌ Respinsă'}
              </span>
            </div>
          </div>
        ))
      )}

      {/* MODAL AMANARE DIRECTA */}
      {modalDir && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setModalDir(null)}>
          <div style={{ background:'#fff', borderRadius:14, padding:18, width:'100%', maxWidth:380 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1F3864' }}>📅 Amânare directă</div>
                <div style={{ fontSize:12, color:'#888' }}>AP {modalDir.nr_apt} — data curentă: {modalDir.data_programata}</div>
              </div>
              <button onClick={() => setModalDir(null)}
                style={{ width:28, height:28, borderRadius:'50%', border:'1px solid #eee', background:'#f5f5f5', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Data nouă *</label>
              <input type="date" value={dirData} onChange={e => setDirData(e.target.value)}
                style={{ width:'100%', padding:'7px 9px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block', fontWeight:600 }}>Motiv *</label>
              <input value={dirMotiv} onChange={e => setDirMotiv(e.target.value)}
                placeholder="Ex: Client nu a plecat, urgent altceva..."
                style={{ width:'100%', padding:'7px 9px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleAmanareDirecta} disabled={dirLoading||!dirData||!dirMotiv.trim()}
                style={{ flex:1, padding:'10px', background:'#1F3864', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', opacity:!dirData||!dirMotiv.trim()?.6:1 }}>
                {dirLoading?'Se salvează...':'✅ Salvează amânarea'}
              </button>
              <button onClick={() => setModalDir(null)}
                style={{ padding:'10px 14px', border:'1px solid #ddd', background:'#fff', borderRadius:9, fontSize:13, cursor:'pointer' }}>Anulează</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
