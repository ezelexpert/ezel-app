import React, { useState, useEffect } from 'react'
import { getMentenanta, updateStatusMentenanta } from '../lib/supabase'

const STATUS_MAP = {
  nou: { label: '🔴 Nou', bg: '#FDECEA', color: '#c0392b' },
  in_lucru: { label: '🟡 În lucru', bg: '#FFF2CC', color: '#7B5E00' },
  rezolvat: { label: '✅ Rezolvat', bg: '#E2EFDA', color: '#375623' },
}

export default function MentenantaTab() {
  const [rapoarte, setRapoarte] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtruApt, setFiltruApt] = useState('')
  const [fotModal, setFotModal] = useState(null)
  const [tabActiv, setTabActiv] = useState('active') // 'active' | 'finalizate'

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
    setRapoarte(prev => prev.map(r => r.id === id ? {...r, status} : r))
  }

  // Filtrare
  const filtrate = rapoarte.filter(r =>
    (!filtruApt || r.nr_apt.includes(filtruApt))
  )

  const active = filtrate.filter(r => r.status === 'nou' || r.status === 'in_lucru')
    .sort((a, b) => {
      // Noi primii, apoi in lucru
      const ord = { nou: 0, in_lucru: 1 }
      if (ord[a.status] !== ord[b.status]) return ord[a.status] - ord[b.status]
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const finalizate = filtrate.filter(r => r.status === 'rezolvat')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const nrNoi = rapoarte.filter(r => r.status === 'nou').length
  const nrInLucru = rapoarte.filter(r => r.status === 'in_lucru').length
  const nrRezolvat = rapoarte.filter(r => r.status === 'rezolvat').length

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>

  function renderRaport(r) {
    const st = STATUS_MAP[r.status] || STATUS_MAP.nou
    const data = new Date(r.created_at).toLocaleString('ro-RO', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    })

    return (
      <div key={r.id} style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:`4px solid ${st.color}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:'#EBF1FB', color:'#1F3864', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700 }}>AP</div>
            <div style={{ fontSize:12, fontWeight:700 }}>{r.nr_apt}</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1F3864' }}>AP {r.nr_apt} — {r.firma||'—'}</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{data}</div>
          </div>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:12, fontWeight:600, background:st.bg, color:st.color, whiteSpace:'nowrap' }}>
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
            <img src={r.foto_url} alt="mentenanta"
              onClick={() => setFotModal(r.foto_url)}
              style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, cursor:'pointer', border:'1px solid #eee' }} />
            <div style={{ fontSize:10, color:'#aaa', marginTop:3, textAlign:'center' }}>Click pentru a mări</div>
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
            <>
              <button onClick={() => schimbaStatus(r.id, 'nou')}
                style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #ddd', background:'#fff', color:'#888', cursor:'pointer', fontSize:12 }}>
                ← Înapoi la nou
              </button>
              <button onClick={() => schimbaStatus(r.id, 'rezolvat')}
                style={{ padding:'6px 12px', borderRadius:7, border:'1.5px solid #C0DD97', background:'#E2EFDA', color:'#375623', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                ✅ Marchează rezolvat
              </button>
            </>
          )}
          {r.status === 'rezolvat' && (
            <button onClick={() => schimbaStatus(r.id, 'in_lucru')}
              style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #ddd', background:'#fff', color:'#888', cursor:'pointer', fontSize:12 }}>
              ↩ Redeschide
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
        <div style={{ background:'#FDECEA', borderRadius:10, padding:'10px 12px', border:'1px solid #F5A0A0', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#c0392b' }}>{nrNoi}</div>
          <div style={{ fontSize:11, color:'#c0392b' }}>🔴 Noi</div>
        </div>
        <div style={{ background:'#FFF2CC', borderRadius:10, padding:'10px 12px', border:'1px solid #F0C040', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#7B5E00' }}>{nrInLucru}</div>
          <div style={{ fontSize:11, color:'#7B5E00' }}>🟡 În lucru</div>
        </div>
        <div style={{ background:'#E2EFDA', borderRadius:10, padding:'10px 12px', border:'1px solid #C0DD97', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{nrRezolvat}</div>
          <div style={{ fontSize:11, color:'#375623' }}>✅ Rezolvate</div>
        </div>
      </div>

      {/* Filtrare apt */}
      <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center' }}>
        <input placeholder="Caută apt..." value={filtruApt} onChange={e => setFiltruApt(e.target.value)}
          style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #ddd', fontSize:13, height:32, width:130 }} />
        <button onClick={load}
          style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:12, height:32 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Tabs Active / Finalizate */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1.5px solid #e0e0e0', marginBottom:12 }}>
        <div onClick={() => setTabActiv('active')}
          style={{ padding:'9px 16px', fontSize:13, cursor:'pointer', fontWeight:500,
            color: tabActiv==='active' ? '#c0392b' : '#888',
            borderBottom: tabActiv==='active' ? '2.5px solid #c0392b' : '2.5px solid transparent' }}>
          🔴 Active ({active.length})
        </div>
        <div onClick={() => setTabActiv('finalizate')}
          style={{ padding:'9px 16px', fontSize:13, cursor:'pointer', fontWeight:500,
            color: tabActiv==='finalizate' ? '#375623' : '#888',
            borderBottom: tabActiv==='finalizate' ? '2.5px solid #375623' : '2.5px solid transparent' }}>
          ✅ Finalizate ({finalizate.length})
        </div>
      </div>

      {/* Lista */}
      {tabActiv === 'active' && (
        active.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
            <div>Nicio problemă activă!</div>
          </div>
        ) : (
          <>
            {/* Grupat: Noi */}
            {active.filter(r => r.status === 'nou').length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:600, color:'#c0392b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                  🔴 Noi — {active.filter(r=>r.status==='nou').length}
                </div>
                {active.filter(r => r.status === 'nou').map(renderRaport)}
              </>
            )}
            {/* Grupat: In lucru */}
            {active.filter(r => r.status === 'in_lucru').length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:600, color:'#7B5E00', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8, marginTop:12 }}>
                  🟡 În lucru — {active.filter(r=>r.status==='in_lucru').length}
                </div>
                {active.filter(r => r.status === 'in_lucru').map(renderRaport)}
              </>
            )}
          </>
        )
      )}

      {tabActiv === 'finalizate' && (
        finalizate.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
            <div>Nicio problemă rezolvată încă.</div>
          </div>
        ) : finalizate.map(renderRaport)
      )}

      {/* Modal foto marita */}
      {fotModal && (
        <div onClick={() => setFotModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16, cursor:'pointer' }}>
          <img src={fotModal} alt="mare" style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:10, objectFit:'contain' }} />
          <div style={{ position:'absolute', top:16, right:16, color:'#fff', fontSize:24 }}>✕</div>
        </div>
      )}
    </div>
  )
}
