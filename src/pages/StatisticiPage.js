import React, { useState, useEffect } from 'react'
import { getStatistici } from '../lib/supabase'

const LUNI_NUME = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

export default function StatisticiPage() {
  const [date, setDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('lunar') // 'lunar' | 'saptamanal' | 'zilnic'
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await getStatistici()
      setDate(d)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă statisticile...</div>
  if (!date) return null

  // ── LUNAR ─────────────────────────────────────────────────
  function renderLunar() {
    const entries = Object.entries(date.peLuna).sort((a,b) => b[0].localeCompare(a[0]))
    if (!entries.length) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Nicio curățenie finalizată încă.</div>

    return entries.map(([key, val]) => {
      const [an, lunaIdx] = key.split('-')
      const lunaName = LUNI_NUME[parseInt(lunaIdx)-1]
      const isExp = expanded === key

      // Grupeaza pe tip in luna
      const peGen = val.curatenii.filter(c=>c.tip_curatenie==='generala').length
      const peInt = val.curatenii.filter(c=>c.tip_curatenie==='intretinere').length
      const peUrg = val.curatenii.filter(c=>c.tip_curatenie==='urgenta').length

      return (
        <div key={key} style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, marginBottom:8, overflow:'hidden' }}>
          <div onClick={() => setExpanded(isExp?null:key)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer' }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'#EBF1FB', color:'#1F3864', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700 }}>{lunaName.substring(0,3)}</div>
              <div style={{ fontSize:10, opacity:.7 }}>{an}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{lunaName} {an}</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                {peGen>0&&`🟡 ${peGen} generale  `}{peInt>0&&`🟢 ${peInt} întreținere  `}{peUrg>0&&`🔵 ${peUrg} urgență`}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#1F3864' }}>{val.total}</div>
              <div style={{ fontSize:11, color:'#888' }}>apartamente</div>
            </div>
            <span style={{ color:'#aaa', fontSize:16, marginLeft:4 }}>{isExp?'▲':'▼'}</span>
          </div>

          {isExp && (
            <div style={{ borderTop:'1px solid #f0f0f0', padding:'10px 14px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#fafafa' }}>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'#666' }}>Data</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'#666' }}>Apt</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'#666' }}>Firmă</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'#666' }}>Tip</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'#666' }}>Finalizat</th>
                  </tr>
                </thead>
                <tbody>
                  {val.curatenii.sort((a,b)=>a.data_programata.localeCompare(b.data_programata)).map(c => (
                    <tr key={c.id} style={{ borderBottom:'1px solid #f0f0f0' }}>
                      <td style={{ padding:'5px 8px' }}>{c.data_programata}</td>
                      <td style={{ padding:'5px 8px', fontWeight:600 }}>AP {c.nr_apt}</td>
                      <td style={{ padding:'5px 8px', color:'#888' }}>{c.firma||'—'}</td>
                      <td style={{ padding:'5px 8px' }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:10, fontWeight:600,
                          background:c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#E2EFDA':'#EBF1FB',
                          color:c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#375623':'#1F3864' }}>
                          {c.tip_curatenie==='generala'?'Generală':c.tip_curatenie==='intretinere'?'Întreținere':'Urgență'}
                        </span>
                      </td>
                      <td style={{ padding:'5px 8px', fontSize:11, color:'#888' }}>{c.data_finalizare||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    })
  }

  // ── SAPTAMANAL ────────────────────────────────────────────
  function renderSaptamanal() {
    const entries = Object.entries(date.peSaptamana).sort((a,b) => b[1].start - a[1].start)
    if (!entries.length) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Nicio curățenie finalizată încă.</div>

    return entries.map(([key, val]) => {
      const isExp = expanded === 's_'+key
      return (
        <div key={key} style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, marginBottom:8, overflow:'hidden' }}>
          <div onClick={() => setExpanded(isExp?null:'s_'+key)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer' }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'#E2EFDA', color:'#375623', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📅</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>Săptămâna {key}</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{val.total} apartamente curățate</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{val.total}</div>
              <div style={{ fontSize:11, color:'#888' }}>total</div>
            </div>
            <span style={{ color:'#aaa', fontSize:16, marginLeft:4 }}>{isExp?'▲':'▼'}</span>
          </div>

          {isExp && (
            <div style={{ borderTop:'1px solid #f0f0f0', padding:'10px 14px' }}>
              {/* Grupeaza pe zi in saptamana */}
              {(() => {
                const peZiLocal = {}
                val.curatenii.forEach(c => {
                  const k = c.data_programata
                  if (!peZiLocal[k]) peZiLocal[k] = []
                  peZiLocal[k].push(c)
                })
                return Object.entries(peZiLocal).sort((a,b)=>a[0].localeCompare(b[0])).map(([zi, cs]) => (
                  <div key={zi} style={{ marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:4 }}>
                      📆 {zi} — {cs.length} apartamente
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {cs.map(c => (
                        <span key={c.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                          background:c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#E2EFDA':'#EBF1FB',
                          color:c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#375623':'#1F3864' }}>
                          AP {c.nr_apt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      )
    })
  }

  // ── ZILNIC ────────────────────────────────────────────────
  function renderZilnic() {
    const entries = Object.entries(date.peZi).sort((a,b) => b[0].localeCompare(a[0]))
    if (!entries.length) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Nicio curățenie finalizată încă.</div>

    return entries.map(([key, val]) => {
      const isExp = expanded === 'z_'+key
      const d = new Date(key)
      const ziSapt = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'][d.getDay()]

      return (
        <div key={key} style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, marginBottom:6, overflow:'hidden' }}>
          <div onClick={() => setExpanded(isExp?null:'z_'+key)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#EDE7F6', color:'#4527A0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{d.getDate()}</div>
              <div style={{ fontSize:9, opacity:.7 }}>{LUNI_NUME[d.getMonth()].substring(0,3)}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{ziSapt}, {key}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
                {val.curatenii.map(c => (
                  <span key={c.id} style={{ fontSize:10, padding:'1px 6px', borderRadius:8,
                    background:c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#E2EFDA':'#EBF1FB',
                    color:c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#375623':'#1F3864',
                    fontWeight:600 }}>AP {c.nr_apt}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#4527A0' }}>{val.total}</div>
            </div>
            <span style={{ color:'#aaa', fontSize:14, marginLeft:4 }}>{isExp?'▲':'▼'}</span>
          </div>

          {isExp && (
            <div style={{ borderTop:'1px solid #f0f0f0', padding:'8px 14px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:'#fafafa' }}>
                  <th style={{ textAlign:'left', padding:'5px 8px', color:'#666' }}>Apt</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', color:'#666' }}>Firmă</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', color:'#666' }}>Tip</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', color:'#666' }}>Finalizat la</th>
                </tr></thead>
                <tbody>
                  {val.curatenii.map(c => (
                    <tr key={c.id} style={{ borderBottom:'1px solid #f0f0f0' }}>
                      <td style={{ padding:'5px 8px', fontWeight:600 }}>AP {c.nr_apt}</td>
                      <td style={{ padding:'5px 8px', color:'#888' }}>{c.firma||'—'}</td>
                      <td style={{ padding:'5px 8px' }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, fontWeight:600,
                          background:c.tip_curatenie==='generala'?'#FDECEA':c.tip_curatenie==='intretinere'?'#E2EFDA':'#EBF1FB',
                          color:c.tip_curatenie==='generala'?'#c0392b':c.tip_curatenie==='intretinere'?'#375623':'#1F3864' }}>
                          {c.tip_curatenie==='generala'?'Generală':c.tip_curatenie==='intretinere'?'Întreținere':'Urgență'}
                        </span>
                      </td>
                      <td style={{ padding:'5px 8px', fontSize:11, color:'#888' }}>{c.data_finalizare||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div style={{ padding:14, maxWidth:900, margin:'0 auto' }}>
      {/* Header stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, marginBottom:16 }}>
        <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #e8e8e8' }}>
          <div style={{ fontSize:11, color:'#888' }}>Total finalizate</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#1F3864' }}>{date.total}</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #e8e8e8' }}>
          <div style={{ fontSize:11, color:'#888' }}>Luni active</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{Object.keys(date.peLuna).length}</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #e8e8e8' }}>
          <div style={{ fontSize:11, color:'#888' }}>Zile cu curățenie</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#4527A0' }}>{Object.keys(date.peZi).length}</div>
        </div>
        {Object.keys(date.peLuna).length > 0 && (
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #e8e8e8' }}>
            <div style={{ fontSize:11, color:'#888' }}>Media/lună</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#C55A11' }}>
              {Math.round(date.total / Object.keys(date.peLuna).length)}
            </div>
          </div>
        )}
      </div>

      {/* View selector */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['lunar','📅 Lunar'],['saptamanal','📆 Săptămânal'],['zilnic','🗓️ Zilnic']].map(([v,lbl]) => (
          <button key={v} onClick={() => { setView(v); setExpanded(null) }}
            style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #ddd', fontSize:13, fontWeight:500, cursor:'pointer',
              background: view===v ? '#1F3864' : '#fff',
              color: view===v ? '#fff' : '#555' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'lunar' && renderLunar()}
      {view === 'saptamanal' && renderSaptamanal()}
      {view === 'zilnic' && renderZilnic()}
    </div>
  )
}
