import React, { useState, useEffect } from 'react'
import { getMentenanta, updateStatusMentenanta, stergeMentenanta } from '../lib/supabase'

const STATUS_MAP = {
  nou: { label: '🔴 Nou', bg: '#FDECEA', color: '#c0392b' },
  in_lucru: { label: '🟡 În lucru', bg: '#FFF2CC', color: '#7B5E00' },
  rezolvat: { label: '✅ Rezolvat', bg: '#E2EFDA', color: '#375623' },
}

export default function MentenantaTab() {
  const [rapoarte, setRapoarte] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtruStatus, setFiltruStatus] = useState('')
  const [filtruApt, setFiltruApt] = useState('')
  const [fotModal, setFotModal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getMentenanta()
      setRapoarte(data)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function schimbaStatus(id, status) {
    await updateStatusMentenanta(id, status)
    setRapoarte(prev => prev.map(r => r.id===id ? {...r, status} : r))
  }

  async function sterge(id) {
    if (!window.confirm('Ștergi raportul?')) return
    await stergeMentenanta(id)
    setRapoarte(prev => prev.filter(r => r.id !== id))
  }

  const filtrate = rapoarte.filter(r =>
    (!filtruStatus || r.status === filtruStatus) &&
    (!filtruApt || r.nr_apt.includes(filtruApt))
  )

  const nou = rapoarte.filter(r => r.status === 'nou').length
  const inLucru = rapoarte.filter(r => r.status === 'in_lucru').length
  const rezolvat = rapoarte.filter(r => r.status === 'rezolvat').length

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8, marginBottom:14 }}>
        <div style={{ background:'#FDECEA', borderRadius:10, padding:'10px 12px', border:'1px solid #F5A0A0' }}>
          <div style={{ fontSize:11, color:'#c0392b' }}>Noi</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#c0392b' }}>{nou}</div>
        </div>
        <div style={{ background:'#FFF2CC', borderRadius:10, padding:'10px 12px', border:'1px solid #F0C040' }}>
          <div style={{ fontSize:11, color:'#7B5E00' }}>În lucru</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#7B5E00' }}>{inLucru}</div>
        </div>
        <div style={{ background:'#E2EFDA', borderRadius:10, padding:'10px 12px', border:'1px solid #C0DD97' }}>
          <div style={{ fontSize:11, color:'#375623' }}>Rezolvate</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{rezolvat}</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #e8e8e8' }}>
          <div style={{ fontSize:11, color:'#888' }}>Total</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#1F3864' }}>{rapoarte.length}</div>
        </div>
      </div>

      {/* Filtre */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        <input placeholder="Caută apt..." value={filtruApt} onChange={e => setFiltruApt(e.target.value)}
          style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #ddd', fontSize:13, height:32, width:120 }} />
        <select value={filtruStatus} onChange={e => setFiltruStatus(e.target.value)}
          style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #ddd', fontSize:13, height:32 }}>
          <option value="">Toate statusurile</option>
          <option value="nou">🔴 Nou</option>
          <option value="in_lucru">🟡 În lucru</option>
          <option value="rezolvat">✅ Rezolvat</option>
        </select>
        <button onClick={load} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:12, height:32 }}>↻ Refresh</button>
      </div>

      {/* Lista rapoarte */}
      {filtrate.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔧</div>
          <div>Niciun raport de mentenanță.</div>
        </div>
      ) : (
        filtrate.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.nou
          const data = new Date(r.created_at).toLocaleString('ro-RO', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })
          return (
            <div key={r.id} style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:`4px solid ${st.color}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                {/* Apt badge */}
                <div style={{ width:42, height:42, borderRadius:10, background:'#EBF1FB', color:'#1F3864', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>AP</div>
                  <div style={{ fontSize:11, fontWeight:700 }}>{r.nr_apt}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1F3864' }}>AP {r.nr_apt} — {r.firma||'—'}</div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{data}</div>
                </div>
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:12, fontWeight:600, background:st.bg, color:st.color }}>
                  {st.label}
                </span>
              </div>

              {/* Descriere */}
              <div style={{ fontSize:13, color:'#333', background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:10, lineHeight:1.5 }}>
                {r.descriere}
              </div>

              {/* Fotografie */}
              {r.foto_url && (
                <div style={{ marginBottom:10 }}>
                  <img src={r.foto_url} alt="mentenanta" onClick={() => setFotModal(r.foto_url)}
                    style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, cursor:'pointer', border:'1px solid #eee' }} />
                  <div style={{ fontSize:10, color:'#aaa', marginTop:4, textAlign:'center' }}>Click pentru a mări</div>
                </div>
              )}

              {/* Actiuni */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {r.status === 'nou' && (
                  <button onClick={() => schimbaStatus(r.id, 'in_lucru')}
                    style={{ padding:'6px 12px', borderRadius:7, border:'1.5px solid #F0C040', background:'#FFF2CC', color:'#7B5E00', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    🟡 Marchează în lucru
                  </button>
                )}
                {r.status === 'in_lucru' && (
                  <button onClick={() => schimbaStatus(r.id, 'rezolvat')}
                    style={{ padding:'6px 12px', borderRadius:7, border:'1.5px solid #C0DD97', background:'#E2EFDA', color:'#375623', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    ✅ Marchează rezolvat
                  </button>
                )}
                {r.status === 'rezolvat' && (
                  <button onClick={() => schimbaStatus(r.id, 'nou')}
                    style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #ddd', background:'#fff', color:'#888', cursor:'pointer', fontSize:12 }}>
                    Redeschide
                  </button>
                )}
                <button onClick={() => sterge(r.id)}
                  style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #F5A0A0', background:'#FDECEA', color:'#c0392b', cursor:'pointer', fontSize:12 }}>
                  🗑 Șterge
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* Modal foto marita */}
      {fotModal && (
        <div onClick={() => setFotModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16, cursor:'pointer' }}>
          <img src={fotModal} alt="mare" style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:10, objectFit:'contain' }} />
          <div style={{ position:'absolute', top:16, right:16, color:'#fff', fontSize:24, cursor:'pointer' }}>✕</div>
        </div>
      )}
    </div>
  )
}
